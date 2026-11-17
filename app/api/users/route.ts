
export const dynamic = "force-dynamic";

import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { database } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  authEnv,
  requireUser,
  ensureOrigin,
  privateJson,
  AuthError,
  authFailure,
} from "@/lib/auth";

const password = z
  .string()
  .min(6, "Use uma senha de pelo menos 6 caracteres.")
  .max(128);

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(180),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),
    password,
    role: z.enum(["admin", "operator"]),
  }),
  z.object({
    action: z.literal("active"),
    id: z.string().min(1),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("reset"),
    id: z.string().min(1),
    password,
  }),
]);

interface UserListRow extends RowDataPacket {
  id: string;
  name: string;
  username: string;
  role: "admin" | "operator";
  active: number;
  must_change: number;
}

export async function GET(request: Request) {
  try {
    await requireUser(request, true);

    const [users] = await database().execute<UserListRow[]>(
      `SELECT
        usuario_cod AS id,
        nome AS name,
        nome_usuario AS username,
        perfil AS role,
        ativo AS active,
        deve_alterar_senha AS must_change
       FROM usuarios
       ORDER BY nome`
    );

    return privateJson({ users });
  } catch (e) {
    return authFailure(e, request);
  }
}

export async function POST(request: Request) {
  try {
    ensureOrigin(request);

    const admin = await requireUser(request, true);
    const v = schema.parse(await request.json());
    const db = database();

    if (v.action === "create") {
      const pepper = authEnv().AUTH_PEPPER;

      if (!pepper) {
        throw new AuthError("Acesso não configurado.", 503);
      }

      await db.execute(
        `INSERT INTO usuarios
          (usuario_cod, nome, nome_usuario, senha_hash, perfil, ativo, deve_alterar_senha)
         VALUES (?, ?, ?, ?, ?, 1, 1)`,
        [
          crypto.randomUUID(),
          v.name,
          v.username,
          await hashPassword(v.password, pepper),
          v.role,
        ]
      );
    } else {
      if (v.id === admin.id) {
        throw new AuthError(
          "Use Trocar senha para sua conta. Você não pode bloquear seu próprio acesso.",
          400
        );
      }

      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [targets] = await connection.execute<
          (RowDataPacket & { id: string })[]
        >(
          "SELECT usuario_cod AS id FROM usuarios WHERE usuario_cod = ? FOR UPDATE",
          [v.id]
        );

        if (!targets[0]) {
          throw new AuthError("Usuário não encontrado.", 404);
        }

        if (v.action === "reset") {
          const pepper = authEnv().AUTH_PEPPER;

          if (!pepper) {
            throw new AuthError("Acesso não configurado.", 503);
          }

          const hashed = await hashPassword(v.password, pepper);

          await connection.execute(
            `UPDATE usuarios
             SET senha_hash = ?, deve_alterar_senha = 1
             WHERE usuario_cod = ?`,
            [hashed, v.id]
          );

          await connection.execute(
            "DELETE FROM sessoes WHERE usuario_cod = ?",
            [v.id]
          );
        } else {
          if (!v.active) {
            const [admins] = await connection.execute<
              (RowDataPacket & { usuario_cod: string })[]
            >(
              `SELECT usuario_cod
               FROM usuarios
               WHERE perfil = 'admin' AND ativo = 1
               FOR UPDATE`
            );

            const targetIsAdmin = admins.some(
              (user) => user.usuario_cod === v.id
            );

            if (targetIsAdmin && admins.length <= 1) {
              throw new AuthError(
                "Mantenha pelo menos um administrador ativo.",
                400
              );
            }
          }

          await connection.execute(
            "UPDATE usuarios SET ativo = ? WHERE usuario_cod = ?",
            [Number(v.active), v.id]
          );

          await connection.execute(
            "DELETE FROM sessoes WHERE usuario_cod = ?",
            [v.id]
          );
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    return privateJson({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return privateJson(
        { error: e.issues[0]?.message || "Confira os campos." },
        400
      );
    }

    if (
      e instanceof Error &&
      "code" in e &&
      e.code === "ER_DUP_ENTRY"
    ) {
      return privateJson(
        { error: "Este usuário já está cadastrado." },
        400
      );
    }

    return authFailure(e, request);
  }
}
