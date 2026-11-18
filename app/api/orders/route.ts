import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { z } from 'zod';

import {
  requireUser,
  ensureOrigin,
  AuthError,
  authFailure,
  privateJson,
} from '@/lib/auth';
import { database } from '@/lib/db';
import {
  InStoreOrderFactory,
  DeliveryOrderFactory,
} from '@/lib/orders/OrderFactory';
import { orderManager } from '@/lib/orders/OrderManager';
import type { Order, OrderStatus } from '@/lib/orders/types';

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

interface OrderRow extends RowDataPacket {
  id: string;
  type: Order['type'];
  status: OrderStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

function mysqlDate(date: Date): string {
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

function toISO(value: string | null): string | null {
  if (!value) return null;
  return value.replace(' ', 'T') + 'Z';
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    createdAt: toISO(row.createdAt)!,
    startedAt: toISO(row.startedAt),
    completedAt: toISO(row.completedAt),
    cancelledAt: toISO(row.cancelledAt),
  };
}

const selectOrders = `
  SELECT
    pedido_cod AS id,
    tipo AS type,
    status,
    criado_em AS createdAt,
    iniciado_em AS startedAt,
    concluido_em AS completedAt,
    cancelado_em AS cancelledAt
  FROM pedidos
`;

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const db = database();
    const { status } = listSchema.parse({
      status: new URL(request.url).searchParams.get('status') || undefined,
    });
    const [rows] = await db.execute<OrderRow[]>(
      `${selectOrders}${status ? ' WHERE status = ?' : ''} ORDER BY criado_em ${status === 'AGUARDANDO' ? 'ASC' : 'DESC'}`,
      status ? [status] : []
    );
    return privateJson({ orders: rows.map(mapOrder) });
  } catch (error) {
    return handleError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    ensureOrigin(request);
    await requireUser(request);
    const data = createSchema.parse(await request.json());
    const factory = data.type === 'PRESENCIAL'
      ? new InStoreOrderFactory()
      : new DeliveryOrderFactory();
    const newOrder = orderManager.createOrder(factory.createOrder());
    const db = database();
    await db.execute(
      `INSERT INTO pedidos
        (pedido_cod, tipo, status, criado_em)
       VALUES (?, ?, ?, ?)`,
      [
        newOrder.id,
        newOrder.type,
        newOrder.status,
        mysqlDate(new Date(newOrder.createdAt)),
      ]
    );
    return privateJson(
      { message: 'Pedido criado com sucesso.', order: newOrder },
      201
    );
  } catch (error) {
    return handleError(error, request);
  }
}

export async function PATCH(request: Request) {
  try {
    ensureOrigin(request);
    await requireUser(request);
    const data = updateSchema.parse(await request.json());

    const transitions: Record<
      'EM_ATENDIMENTO' | 'CONCLUIDO' | 'CANCELADO',
      { previous: OrderStatus[]; dateColumn: string }
    > = {
      EM_ATENDIMENTO: {
        previous: ['AGUARDANDO'],
        dateColumn: 'iniciado_em',
      },
      CONCLUIDO: {
        previous: ['EM_ATENDIMENTO'],
        dateColumn: 'concluido_em',
      },
      CANCELADO: {
        previous: ['AGUARDANDO', 'EM_ATENDIMENTO'],
        dateColumn: 'cancelado_em',
      },
    };

    const transition = transitions[data.status];
    const db = database();
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE pedidos
       SET status = ?, ${transition.dateColumn} = ?
       WHERE pedido_cod = ? AND status IN (${transition.previous.map(() => '?').join(', ')})`,
      [
        data.status,
        mysqlDate(new Date()),
        data.id,
        ...transition.previous,
      ]
    );
    if (result.affectedRows === 0) {
      return privateJson(
        { error: 'Pedido não encontrado ou mudança de status não permitida.' },
        409
      );
    }
    const [rows] = await db.execute<OrderRow[]>(
      `${selectOrders} WHERE pedido_cod = ?`,
      [data.id]
    );
    const order = mapOrder(rows[0]);
    return privateJson({
      message: 'Status atualizado com sucesso.',
      order,
      waitingTime: orderManager.calculateWaitingTime(order),
      serviceTime: orderManager.calculateServiceTime(order),
    });
  } catch (error) {
    return handleError(error, request);
  }
}

function handleError(error: unknown, request: Request) {
  if (error instanceof AuthError) return authFailure(error, request);
  if (error instanceof z.ZodError) {
    return privateJson({ error: 'Dados inválidos. Confira os campos.' }, 400);
  }
  console.error('Erro na API de pedidos:', error);
  return privateJson({ error: 'Não foi possível processar o pedido.' }, 500);
}
