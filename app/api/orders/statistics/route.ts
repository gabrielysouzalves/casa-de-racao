import type { RowDataPacket } from 'mysql2';

import {
  requireUser,
  AuthError,
  authFailure,
  privateJson,
} from '@/lib/auth';

import { database } from '@/lib/db';

import { calculateOrderStatistics } from '@/lib/orders/OrderStatistics';
import type { Order } from '@/lib/orders/types';

export const dynamic = 'force-dynamic';

// Estrutura dos pedidos retornados pelo MySQL

interface OrderRow extends RowDataPacket {
  id: string;
  type: Order['type'];
  status: Order['status'];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

// Converte as datas do MySQL para o formato ISO

const toISO = (value: string | null): string | null => {
  if (!value) return null;

  return value.replace(' ', 'T') + 'Z';
};

// GET — Consultar estatísticas dos atendimentos

export async function GET(request: Request) {
  try {
    // Verifica se o usuário está autenticado
    await requireUser(request);

    const db = database();

    // Consulta os pedidos armazenados no MySQL
    const [rows] = await db.execute<OrderRow[]>(`
      SELECT
        pedido_cod AS id,
        tipo AS type,
        status,
        criado_em AS createdAt,
        iniciado_em AS startedAt,
        concluido_em AS completedAt,
        cancelado_em AS cancelledAt
      FROM pedidos
    `);

    // Converte os registros para o formato utilizado pela aplicação
    const orders: Order[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      createdAt: toISO(row.createdAt)!,
      startedAt: toISO(row.startedAt),
      completedAt: toISO(row.completedAt),
      cancelledAt: toISO(row.cancelledAt),
    }));

    // Calcula as estatísticas
    const statistics = calculateOrderStatistics(orders);

    // Retorna os resultados em JSON
    return privateJson(statistics);

  } catch (error) {
    if (error instanceof AuthError) {
      return authFailure(error, request);
    }

    console.error('Erro ao calcular estatísticas:', error);

    return privateJson(
      {
        error: 'Não foi possível calcular as estatísticas.',
      },
      500
    );
  }
}