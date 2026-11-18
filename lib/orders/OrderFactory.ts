import type { Order, OrderType } from './types';

// Classe abstrata que define a criação de pedidos
abstract class OrderFactory {
  abstract createOrder(): Order;

  protected buildOrder(type: OrderType): Order {
    return {
      id: crypto.randomUUID(),
      type,
      status: 'AGUARDANDO',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
    };
  }
}

// Fábrica para pedidos presenciais
export class InStoreOrderFactory extends OrderFactory {
  createOrder(): Order {
    return this.buildOrder('PRESENCIAL');
  }
}

// Fábrica para pedidos de entrega
export class DeliveryOrderFactory extends OrderFactory {
  createOrder(): Order {
    return this.buildOrder('ENTREGA');
  }
}