import { KitchenOrder, ok, err, type Result } from '@restaurant-os/domain';
import type { KitchenOrderRepository } from '../../ports/kitchen-order-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface MarkKitchenOrderReadyInput {
  kitchenOrderId: string;
}

export class MarkKitchenOrderReadyUseCase {
  constructor(
    private readonly kitchenOrderRepo: KitchenOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: MarkKitchenOrderReadyInput): Promise<Result<KitchenOrder, Error>> {
    const kitchenOrder = await this.kitchenOrderRepo.findById(input.kitchenOrderId);
    if (!kitchenOrder) {
      return err(new Error('Kitchen order not found'));
    }

    const ready = kitchenOrder.markReady();
    if (!ready.success) {
      return err(ready.error);
    }

    await this.kitchenOrderRepo.save(ready.value);
    await this.eventPublisher.publish('ORDER_READY', {
      kitchenOrderId: ready.value.id,
      orderId: ready.value.orderId,
      restaurantId: ready.value.restaurantId,
    });

    return ok(ready.value);
  }
}
