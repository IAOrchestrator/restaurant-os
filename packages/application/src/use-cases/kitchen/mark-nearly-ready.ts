import { KitchenOrder, ok, err, type Result } from '@restaurant-os/domain';
import type { KitchenOrderRepository } from '../../ports/kitchen-order-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface MarkNearlyReadyInput {
  kitchenOrderId: string;
}

export class MarkNearlyReadyUseCase {
  constructor(
    private readonly kitchenOrderRepo: KitchenOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: MarkNearlyReadyInput): Promise<Result<KitchenOrder, Error>> {
    const kitchenOrder = await this.kitchenOrderRepo.findById(input.kitchenOrderId);
    if (!kitchenOrder) {
      return err(new Error('Kitchen order not found'));
    }

    const nearly = kitchenOrder.markNearlyReady();
    if (!nearly.success) {
      return err(nearly.error);
    }

    await this.kitchenOrderRepo.save(nearly.value);
    await this.eventPublisher.publish('ORDER_NEARLY_READY', {
      kitchenOrderId: nearly.value.id,
      orderId: nearly.value.orderId,
      restaurantId: nearly.value.restaurantId,
    });

    return ok(nearly.value);
  }
}
