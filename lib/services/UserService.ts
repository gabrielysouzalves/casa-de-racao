import type { RowDataPacket } from 'mysql2';
import { database } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { authEnv, AuthError } from '@/lib/auth';

export type UserAction =
  | { action: 'create'; name: string; username: string; password: string; role: 'admin' | 'operator' }
  | { action: 'active'; id: string; active: boolean }
  | { action: 'reset'; id: string; password: string };

interface UserListRow extends RowDataPacket {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'operator';
  active: number;
  must_change: number;
}

export class UserService {
  async list(): Promise<UserListRow[]> {
    const [users] = await database().execute<UserListRow[]>(
      `SELECT usuario_cod AS id, nome AS name, nome_usuario AS username,
              perfil AS role, ativo AS active, deve_alterar_senha AS must_change
       FROM usuarios ORDER BY nome`
    );
    return users;
  }

  async apply(v: UserAction, adminId: string): Promise<void> {
    const db = database();
    if (v.action === 'create') {
      const pepper = authEnv().AUTH_PEPPER;
      if (!pepper) throw new AuthError('Acesso não configurado.', 503);
      await db.execute(
        `INSERT INTO usuarios
          (usuario_cod, nome, nome_usuario, senha_hash, perfil, ativo, deve_alterar_senha)
         VALUES (?, ?, ?, ?, ?, 1, 1)`,
        [crypto.randomUUID(), v.name, v.username, await hashPassword(v.password, pepper), v.role],
      );
      return;
    }

    if (v.id === adminId) {
      throw new AuthError(
        'Use Trocar senha para sua conta. Você não pode bloquear seu próprio acesso.',
        400,
      );
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [targets] = await connection.execute<(RowDataPacket & { id: string })[]>(
        'SELECT usuario_cod AS id FROM usuarios WHERE usuario_cod = ? FOR UPDATE',
        [v.id],
      );
      if (!targets[0]) throw new AuthError('Usuário não encontrado.', 404);

      if (v.action === 'reset') {
        const pepper = authEnv().AUTH_PEPPER;
        if (!pepper) throw new AuthError('Acesso não configurado.', 503);
        const hashed = await hashPassword(v.password, pepper);
        await connection.execute(
          `UPDATE usuarios SET senha_hash = ?, deve_alterar_senha = 1
           WHERE usuario_cod = ?`,
          [hashed, v.id],
        );
      } else {
        if (!v.active) {
          const [admins] = await connection.execute<(RowDataPacket & { usuario_cod: string })[]>(
            `SELECT usuario_cod FROM usuarios
             WHERE perfil = 'admin' AND ativo = 1 FOR UPDATE`,
          );
          const targetIsAdmin = admins.some((user) => user.usuario_cod === v.id);
          if (targetIsAdmin && admins.length <= 1) {
            throw new AuthError('Mantenha pelo menos um administrador ativo.', 400);
          }
        }
        await connection.execute(
          'UPDATE usuarios SET ativo = ? WHERE usuario_cod = ?',
          [Number(v.active), v.id],
        );
      }
      await connection.execute('DELETE FROM sessoes WHERE usuario_cod = ?', [v.id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const userService = new UserService();
