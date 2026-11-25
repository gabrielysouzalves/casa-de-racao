import { z } from 'zod';
import {
  AuthError, authFailure, ensureOrigin, privateJson,
} from '@/lib/auth';
import { authSchema } from '@/lib/services/AuthSchema';
import { authService } from '@/lib/services/AuthService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return privateJson(await authService.current(request));
  } catch (error) {
    return authFailure(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const action = authSchema.parse(await request.json());
    if (action.action === 'mobileLogin') {
      if (origin && origin !== new URL(request.url).origin) {
        throw new AuthError('Requisição não autorizada', 403);
      }
    } else {
      ensureOrigin(request);
    }

    if (action.action === 'logout') {
      const result = await authService.logout(request);
      return privateJson(result.data, 200, result.headers);
    }

    if (action.action === 'login' || action.action === 'mobileLogin') {
      const result = await authService.login(request, action);
      return privateJson(result.data, 200, result.headers);
    }

    const result = await authService.changePassword(request, action);
    return privateJson(result.data, 200, result.headers);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return privateJson({ error: error.issues[0]?.message || 'Confira os campos.' }, 400);
    }
    return authFailure(error, request);
  }
}
