import type { RowDataPacket } from 'mysql2';
import { database } from '@/lib/db';
import { hashPassword, verifyPassword, digest } from '@/lib/password';
import {
  authEnv, publicUser, currentUser, sessionToken, cookie,
  createSession, createSessionToken, AuthError, type UserRow,
} from '@/lib/auth';
import type { AuthAction } from './AuthSchema';

async function rateLimit(request: Request, name: string) {
  const db = database();
  const now = Date.now();
  const expires = now + 15 * 60 * 1000;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const keys = [
    ["ip:" + ip, 60],
    ["user:" + name, 10],
  ] as const;

  for (const [key, max] of keys) {
    const hashedKey = await digest(key);

    await db.execute(
      `INSERT INTO limites_login (chave, tentativas, expira_em)
       VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE
       tentativas = IF(expira_em <= ?, 1, tentativas + 1),
       expira_em = IF(expira_em <= ?, VALUES(expira_em), expira_em)`,
      [hashedKey, expires, now, now]
    );

    const [rows] = await db.execute<
      (RowDataPacket & { tentativas: number })[]
    >(
      "SELECT tentativas FROM limites_login WHERE chave = ?",
      [hashedKey]
    );

    if (!rows[0] || rows[0].tentativas > max) {
      throw new AuthError(
        "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
        429
      );
    }
  }

  await db.execute(
    "DELETE FROM limites_login WHERE expira_em < ? LIMIT 100",
    [now]
  );
}

async function createInitialAdmin(
  initialHash: string,
  db: ReturnType<typeof database>
) {
  const connection = await db.getConnection();

  try {
    const [lockRows] = await connection.query<
      (RowDataPacket & { acquired: number | null })[]
    >("SELECT GET_LOCK(?, 10) AS acquired", [
      "casa_de_racao_admin_bootstrap",
    ]);

    if (lockRows[0]?.acquired !== 1) {
      throw new AuthError(
        "Não foi possível inicializar o administrador. Tente novamente.",
        503
      );
    }

    try {
      const [countRows] = await connection.query<
        (RowDataPacket & { total: number })[]
      >("SELECT COUNT(*) AS total FROM usuarios");

      if (Number(countRows[0]?.total) === 0) {
        await connection.execute(
          `INSERT IGNORE INTO usuarios
           (usuario_cod, nome, nome_usuario, senha_hash, perfil, ativo, deve_alterar_senha)
           VALUES (?, 'Administrador', 'admin', ?, 'admin', 1, 1)`,
          [crypto.randomUUID(), initialHash]
        );
      }
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [
        "casa_de_racao_admin_bootstrap",
      ]);
    }
  } finally {
    connection.release();
  }
}



export class AuthService {
  async current(request: Request) {
    const user = await currentUser(request);
    return { user: user ? publicUser(user) : null };
  }

  async logout(request: Request) {
    const token = sessionToken(request);
    if (token) {
      await database().execute(
        'DELETE FROM sessoes WHERE token_hash = ?',
        [await digest(token)],
      );
    }
    return {
      data: { ok: true },
      headers: { 'Set-Cookie': cookie(request, '', 0) },
    };
  }

  async login(request: Request, v: Extract<AuthAction, { action: 'login' | 'mobileLogin' }>) {
    const config = authEnv();
    if (!config.AUTH_PEPPER || !config.INITIAL_ADMIN_HASH) {
      throw new AuthError('Acesso ainda não configurado. Contate o administrador.', 503);
    }

    await rateLimit(request, v.username);
    const db = database();
    const [users] = await db.execute<UserRow[]>(
      `SELECT
        usuario_cod AS id,
        nome AS name,
        nome_usuario AS username,
        senha_hash AS password_hash,
        perfil AS role,
        ativo AS active,
        deve_alterar_senha AS must_change
       FROM usuarios
       WHERE nome_usuario = ?
       LIMIT 1`,
      [v.username],
    );

    let user = users[0] ?? null;
    let valid = await verifyPassword(
      v.password, user?.password_hash || config.INITIAL_ADMIN_HASH, config.AUTH_PEPPER,
    );

    if (!user && v.username === 'admin' && valid) {
      await createInitialAdmin(config.INITIAL_ADMIN_HASH, db);
      const [createdUsers] = await db.execute<UserRow[]>(
        `SELECT
          usuario_cod AS id,
          nome AS name,
          nome_usuario AS username,
          senha_hash AS password_hash,
          perfil AS role,
          ativo AS active,
          deve_alterar_senha AS must_change
         FROM usuarios
         WHERE nome_usuario = ?
         LIMIT 1`,
        ['admin'],
      );
      user = createdUsers[0] ?? null;
      if (user && user.password_hash !== config.INITIAL_ADMIN_HASH) {
        valid = await verifyPassword(v.password, user.password_hash, config.AUTH_PEPPER);
      }
    }

    if (!user || !user.active || !valid) {
      throw new AuthError('Usuário ou senha inválidos.', 401);
    }
    await db.execute(
      'DELETE FROM limites_login WHERE chave = ?',
      [await digest('user:' + v.username)],
    );

    if (v.action === 'mobileLogin') {
      return { data: { user: publicUser(user), token: await createSessionToken(user.id) } };
    }
    return {
      data: { user: publicUser(user) },
      headers: { 'Set-Cookie': await createSession(user.id, request) },
    };
  }

  async changePassword(
    request: Request,
    v: Extract<AuthAction, { action: 'password' }>,
  ) {
    const config = authEnv();
    if (!config.AUTH_PEPPER || !config.INITIAL_ADMIN_HASH) {
      throw new AuthError('Acesso ainda não configurado. Contate o administrador.', 503);
    }

    const user = await currentUser(request);
    if (!user) throw new AuthError('Entre para continuar.', 401);
    await rateLimit(request, 'password:' + user.id);
    if (!(await verifyPassword(v.currentPassword, user.password_hash, config.AUTH_PEPPER))) {
      throw new AuthError('A senha atual está incorreta.', 400);
    }
    if (v.currentPassword === v.newPassword) {
      throw new AuthError('Escolha uma senha diferente da atual.', 400);
    }
    const hashed = await hashPassword(v.newPassword, config.AUTH_PEPPER);
    const connection = await database().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        'UPDATE usuarios SET senha_hash = ?, deve_alterar_senha = 0 WHERE usuario_cod = ?',
        [hashed, user.id],
      );
      await connection.execute(
        'DELETE FROM sessoes WHERE usuario_cod = ?',
        [user.id],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return {
      data: { user: publicUser({ ...user, must_change: 0 }) },
      headers: { 'Set-Cookie': await createSession(user.id, request) },
    };
  }
}

export const authService = new AuthService();
