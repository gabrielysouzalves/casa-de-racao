import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { database } from '@/lib/db';
import type { Order, OrderStatus } from './types';

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
  return value ? value.replace(' ', 'T') + 'Z' : null;
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

export class OrderRepository {
  async findAll(status?: OrderStatus): Promise<Order[]> {
    const [rows] = await database().execute<OrderRow[]>(
      `${selectOrders}${status ? ' WHERE status = ?' : ''} ORDER BY criado_em ${status === 'AGUARDANDO' ? 'ASC' : 'DESC'}`,
      status ? [status] : [],
    );
    return rows.map(mapOrder);
  }

  async findById(id: string): Promise<Order | null> {
    const [rows] = await database().execute<OrderRow[]>(
      `${selectOrders} WHERE pedido_cod = ?`, [id],
    );
    return rows[0] ? mapOrder(rows[0]) : null;
  }

  async create(order: Order): Promise<void> {
    await database().execute(
      `INSERT INTO pedidos (pedido_cod, tipo, status, criado_em)
       VALUES (?, ?, ?, ?)`,
      [order.id, order.type, order.status, mysqlDate(new Date(order.createdAt))],
    );
  }

  async changeStatus(
    id: string,
    status: 'EM_ATENDIMENTO' | 'CONCLUIDO' | 'CANCELADO',
    previousStatuses: OrderStatus[],
  ): Promise<boolean> {
    const columns = {
      EM_ATENDIMENTO: 'iniciado_em',
      CONCLUIDO: 'concluido_em',
      CANCELADO: 'cancelado_em',
    } as const;
    const [result] = await database().execute<ResultSetHeader>(
      `UPDATE pedidos
       SET status = ?, ${columns[status]} = ?
       WHERE pedido_cod = ? AND status IN (${previousStatuses.map(() => '?').join(', ')})`,
      [status, mysqlDate(new Date()), id, ...previousStatuses],
    );
    return result.affectedRows > 0;
  }
}

export const orderRepository = new OrderRepository();
