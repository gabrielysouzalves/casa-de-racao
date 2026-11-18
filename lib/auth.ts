import type { RowDataPacket } from "mysql2";
import { database } from "./db";
import { digest, PasswordBusyError } from "./password";

export interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  role: "admin" | "operator";
  active: number;
  must_change: number;
}

export type PublicUser = {
  id: string;
  name: string;
  username: string;
  role: "admin" | "operator";
  mustChange: boolean;
};

export const authEnv = () => ({
  AUTH_PEPPER: process.env.AUTH_PEPPER,
  INITIAL_ADMIN_HASH: process.env.INITIAL_ADMIN_HASH,
});

export const publicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  name: u.name,
  username: u.username,
  role: u.role,
  mustChange: !!u.must_change,
});

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const privateJson = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {}
) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      ...headers,
    },
  });

export function ensureOrigin(request: Request) {
  const bearer = request.headers.get("authorization");
  if (bearer && /^Bearer [a-f0-9]{64}$/.test(bearer)) return;
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    throw new AuthError("Requisição não autorizada", 403);
  }
}

export function sessionToken(request: Request) {
  const bearer = request.headers.get("authorization");
  if (bearer && /^Bearer [a-f0-9]{64}$/.test(bearer)) {
    return bearer.slice(7);
  }

  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("racao_session="))
      ?.slice(14) || ""
  );
}

export async function currentUser(request: Request) {
  const token = sessionToken(request);

  if (!/^[a-f0-9]{64}$/.test(token)) return null;

  const [rows] = await database().execute<UserRow[]>(
    `SELECT
      u.usuario_cod AS id,
      u.nome AS name,
      u.nome_usuario AS username,
      u.senha_hash AS password_hash,
      u.perfil AS role,
      u.ativo AS active,
      u.deve_alterar_senha AS must_change
    FROM usuarios u
    INNER JOIN sessoes s ON s.usuario_cod = u.usuario_cod
    WHERE s.token_hash = ?
      AND s.expira_em > ?
      AND u.ativo = 1
    LIMIT 1`,
    [await digest(token), Date.now()]
  );

  return rows[0] ?? null;
}

export async function requireUser(request: Request, admin = false) {
  const user = await currentUser(request);

  if (!user) {
    throw new AuthError("Entre para acessar o sistema.", 401);
  }

  if (user.must_change) {
    throw new AuthError("Troque sua senha para continuar.", 403);
  }

  if (admin && user.role !== "admin") {
    throw new AuthError("Acesso exclusivo do administrador.", 403);
  }

  return user;
}

export function cookie(
  request: Request,
  token: string,
  maxAge = 8 * 60 * 60
) {
  return `racao_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    new URL(request.url).protocol === "https:" ? "; Secure" : ""
  }`;
}

export async function createSessionToken(userId: string) {
  const token = Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    (b) => b.toString(16).padStart(2, "0")
  ).join("");

  const db = database();

  await db.execute(
    "DELETE FROM sessoes WHERE expira_em <= ? LIMIT 100",
    [Date.now()]
  );

  await db.execute(
    "INSERT INTO sessoes (token_hash, usuario_cod, expira_em) VALUES (?, ?, ?)",
    [await digest(token), userId, Date.now() + 8 * 60 * 60 * 1000]
  );

  return token;
}

export async function createSession(userId: string, request: Request) {
  return cookie(request, await createSessionToken(userId));
}

export async function authFailure(e: unknown, request?: Request) {
  if (request?.body && !request.bodyUsed) {
    try {
      const reader = request.body.getReader();
      let size = 0;

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;

        size += chunk.value.byteLength;

        if (size > 16384) {
          await reader.cancel();
          break;
        }
      }
    } catch {
      // Ignora erros durante a leitura do corpo.
    }
  }

  if (e instanceof AuthError) {
    return privateJson({ error: e.message }, e.status);
  }

  if (e instanceof PasswordBusyError) {
    return privateJson({ error: e.message }, 429);
  }

  console.error("Authentication error", e);

  return privateJson(
    { error: "Não foi possível concluir. Tente novamente." },
    503
  );
}
