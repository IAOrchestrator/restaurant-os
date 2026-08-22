import { Order } from '@restaurant-os/domain';
import type { OrderRepository } from '../../ports/order-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface StartPreparingInput {
  orderId: string;
}

export class StartPreparingUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: StartPreparingInput): Promise<Result<Order, Error>> {
    const order = await this.orderRepo.findById(input.orderId);
    if (!order) {
      return err(new Error('Order not found'));
    }

    const preparing = order.startPreparing();
    if (!preparing.success) {
      return err(preparing.error);
    }

    await this.orderRepo.save(preparing.value);
    await this.eventPublisher.publish('KITCHEN_STARTED', {
      orderId: preparing.value.id,
      restaurantId: preparing.value.restaurantId,
    });

    return ok(preparing.value);
  }
}
