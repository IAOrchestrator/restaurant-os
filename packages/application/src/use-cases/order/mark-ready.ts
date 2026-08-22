import { Order } from '@restaurant-os/domain';
import type { OrderRepository } from '../../ports/order-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface MarkOrderReadyInput {
  orderId: string;
}

export class MarkOrderReadyUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: MarkOrderReadyInput): Promise<Result<Order, Error>> {
    const order = await this.orderRepo.findById(input.orderId);
    if (!order) {
      return err(new Error('Order not found'));
    }

    const ready = order.markReady();
    if (!ready.success) {
      return err(ready.error);
    }

    await this.orderRepo.save(ready.value);
    await this.eventPublisher.publish('ORDER_READY', {
      orderId: ready.value.id,
      restaurantId: ready.value.restaurantId,
      tableSessionId: ready.value.tableSessionId,
    });

    return ok(ready.value);
  }
}
