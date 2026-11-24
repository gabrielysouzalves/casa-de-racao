import {
  requireUser,
  AuthError,
  authFailure,
  privateJson,
} from '@/lib/auth';
import { orderService } from '@/lib/orders/OrderService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireUser(request);
    return privateJson(await orderService.statistics());
  } catch (error) {
    if (error instanceof AuthError) {
      return authFailure(error, request);
    }
    console.error('Erro ao calcular estatísticas:', error);
    return privateJson({ error: 'Não foi possível calcular as estatísticas.' }, 500);
  }
}
