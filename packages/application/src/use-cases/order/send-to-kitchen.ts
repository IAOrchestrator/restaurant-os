import { Order } from '@restaurant-os/domain';
import type { OrderRepository } from '../../ports/order-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface SendToKitchenInput {
  orderId: string;
}

export class SendToKitchenUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: SendToKitchenInput): Promise<Result<Order, Error>> {
    const order = await this.orderRepo.findById(input.orderId);
    if (!order) {
      return err(new Error('Order not found'));
    }

    let targetOrder = order;
    if (targetOrder.status === 'DRAFT') {
      const confirmed = targetOrder.confirm();
      if (!confirmed.success) {
        return err(confirmed.error);
      }
      targetOrder = confirmed.value;
    }

    const sent = targetOrder.sendToKitchen();
    if (!sent.success) {
      return err(sent.error);
    }

    await this.orderRepo.save(sent.value);
    await this.eventPublisher.publish('ORDER_SENT_TO_KITCHEN', {
      orderId: sent.value.id,
      restaurantId: sent.value.restaurantId,
      tableSessionId: sent.value.tableSessionId,
    });
    await this.eventPublisher.publish('KITCHEN_RECEIVED', {
      orderId: sent.value.id,
      restaurantId: sent.value.restaurantId,
    });

    return ok(sent.value);
  }
}
