export type OrderType = 'PRESENCIAL' | 'ENTREGA';

export type OrderStatus =
  | 'AGUARDANDO'
  | 'EM_ATENDIMENTO'
  | 'CONCLUIDO'
  | 'CANCELADO';

export interface Order {
  id: string;
  type: OrderType;
  status: OrderStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}