import { Order } from '@restaurant-os/domain';
import type { OrderRepository } from '../../ports/order-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface DeliverOrderInput {
  orderId: string;
}

export class DeliverOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: DeliverOrderInput): Promise<Result<Order, Error>> {
    const order = await this.orderRepo.findById(input.orderId);
    if (!order) {
      return err(new Error('Order not found'));
    }

    let targetOrder = order;
    if (targetOrder.status === 'SENT_TO_KITCHEN') {
      const prep = targetOrder.startPreparing();
      if (prep.success) targetOrder = prep.value;
    }
    if (targetOrder.status === 'PREPARING') {
      const ready = targetOrder.markReady();
      if (ready.success) targetOrder = ready.value;
    }

    const delivered = targetOrder.deliver();
    if (!delivered.success) {
      return err(delivered.error);
    }

    await this.orderRepo.save(delivered.value);
    await this.eventPublisher.publish('ORDER_DELIVERED', {
      orderId: delivered.value.id,
      restaurantId: delivered.value.restaurantId,
      tableSessionId: delivered.value.tableSessionId,
    });

    return ok(delivered.value);
  }
}
