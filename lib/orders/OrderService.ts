import { DeliveryOrderFactory, InStoreOrderFactory } from './OrderFactory';
import { orderManager } from './OrderManager';
import { orderRepository } from './OrderRepository';
import { calculateOrderStatistics } from './OrderStatistics';
import type { OrderStatus, OrderType } from './types';

export class OrderTransitionError extends Error {}

export class OrderService {
  constructor(private readonly repository = orderRepository) {}

  async list(status?: OrderStatus) {
    return this.repository.findAll(status);
  }

  async create(type: OrderType) {
    const factory = type === 'PRESENCIAL'
      ? new InStoreOrderFactory()
      : new DeliveryOrderFactory();
    const order = orderManager.createOrder(factory.createOrder());
    await this.repository.create(order);
    return order;
  }

  async changeStatus(id: string, status: 'EM_ATENDIMENTO' | 'CONCLUIDO' | 'CANCELADO') {
    const previousStatuses = orderManager.getPreviousStatuses(status);
    const updated = await this.repository.changeStatus(id, status, previousStatuses);
    if (!updated) {
      throw new OrderTransitionError('Pedido não encontrado ou mudança de status não permitida.');
    }

    const order = await this.repository.findById(id);
    if (!order) throw new Error('Pedido atualizado não encontrado.');

    return {
      order,
      waitingTime: orderManager.calculateWaitingTime(order),
      serviceTime: orderManager.calculateServiceTime(order),
    };
  }

  async statistics() {
    return calculateOrderStatistics(await this.repository.findAll());
  }
}

export const orderService = new OrderService();
