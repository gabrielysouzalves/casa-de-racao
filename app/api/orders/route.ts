import { z } from 'zod';
import {
  requireUser, ensureOrigin, AuthError, authFailure, privateJson,
} from '@/lib/auth';
import { orderService, OrderTransitionError } from '@/lib/orders/OrderService';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  type: z.enum(['PRESENCIAL', 'ENTREGA']),
});

const listSchema = z.object({
  status: z.enum(['AGUARDANDO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO']).optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO']),
});

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const { status } = listSchema.parse({
      status: new URL(request.url).searchParams.get('status') || undefined,
    });
    return privateJson({ orders: await orderService.list(status) });
  } catch (error) {
    return handleError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    ensureOrigin(request);
    await requireUser(request);
    const { type } = createSchema.parse(await request.json());
    const order = await orderService.create(type);
    return privateJson({ message: 'Pedido criado com sucesso.', order }, 201);
  } catch (error) {
    return handleError(error, request);
  }
}

export async function PATCH(request: Request) {
  try {
    ensureOrigin(request);
    await requireUser(request);
    const { id, status } = updateSchema.parse(await request.json());
    const result = await orderService.changeStatus(id, status);
    return privateJson({ message: 'Status atualizado com sucesso.', ...result });
  } catch (error) {
    return handleError(error, request);
  }
}

function handleError(error: unknown, request: Request) {
  if (error instanceof AuthError) return authFailure(error, request);
  if (error instanceof z.ZodError) {
    return privateJson({ error: 'Dados inválidos. Confira os campos.' }, 400);
  }
  if (error instanceof OrderTransitionError) {
    return privateJson({ error: error.message }, 409);
  }
  console.error('Erro na API de pedidos:', error);
  return privateJson({ error: 'Não foi possível processar o pedido.' }, 500);
}
