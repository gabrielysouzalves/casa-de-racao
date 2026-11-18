import type { Order, OrderStatus } from './types';

export class OrderManager {
  private static instance: OrderManager;

  private constructor() {}

  public static getInstance(): OrderManager {
    if (!OrderManager.instance) {
      OrderManager.instance = new OrderManager();
    }

    return OrderManager.instance;
  }

  public getPreviousStatuses(status: 'EM_ATENDIMENTO' | 'CONCLUIDO' | 'CANCELADO'): OrderStatus[] {
    switch (status) {
      case 'EM_ATENDIMENTO':
        return ['AGUARDANDO'];
      case 'CONCLUIDO':
        return ['EM_ATENDIMENTO'];
      case 'CANCELADO':
        return ['AGUARDANDO', 'EM_ATENDIMENTO'];
    }
  }

  public createOrder(order: Order): Order {
    return order;
  }

  public calculateWaitingTime(order: Order): number | null {
    if (!order.startedAt) return null;

    return (
      new Date(order.startedAt).getTime() -
      new Date(order.createdAt).getTime()
    ) / 60000;
  }

  public calculateServiceTime(order: Order): number | null {
    if (!order.startedAt || !order.completedAt) return null;

    return (
      new Date(order.completedAt).getTime() -
      new Date(order.startedAt).getTime()
    ) / 60000;
  }
}

export const orderManager = OrderManager.getInstance();