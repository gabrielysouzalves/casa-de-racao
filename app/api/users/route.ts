import { z } from 'zod';
import {
  requireUser, ensureOrigin, privateJson, authFailure,
} from '@/lib/auth';
import { userService } from '@/lib/services/UserService';

export const dynamic = 'force-dynamic';

const password = z.string().min(6, 'Use uma senha de pelo menos 6 caracteres.').max(128);
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(1).max(180),
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),
    password,
    role: z.enum(['admin', 'operator']),
  }),
  z.object({ action: z.literal('active'), id: z.string().min(1), active: z.boolean() }),
  z.object({ action: z.literal('reset'), id: z.string().min(1), password }),
]);

export async function GET(request: Request) {
  try {
    await requireUser(request, true);
    return privateJson({ users: await userService.list() });
  } catch (error) {
    return authFailure(error, request);
  }
}

export async function POST(request: Request) {
  try {
    ensureOrigin(request);
    const admin = await requireUser(request, true);
    const data = schema.parse(await request.json());
    await userService.apply(data, admin.id);
    return privateJson({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return privateJson({ error: error.issues[0]?.message || 'Confira os campos.' }, 400);
    }
    if (error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return privateJson({ error: 'Este usuário já está cadastrado.' }, 400);
    }
    return authFailure(error, request);
  }
}
