import { KitchenOrder, ok, err, type Result } from '@restaurant-os/domain';
import type { KitchenOrderRepository } from '../../ports/kitchen-order-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface StartKitchenOrderInput {
  kitchenOrderId: string;
}

export class StartKitchenOrderUseCase {
  constructor(
    private readonly kitchenOrderRepo: KitchenOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: StartKitchenOrderInput): Promise<Result<KitchenOrder, Error>> {
    const kitchenOrder = await this.kitchenOrderRepo.findById(input.kitchenOrderId);
    if (!kitchenOrder) {
      return err(new Error('Kitchen order not found'));
    }

    const started = kitchenOrder.start();
    if (!started.success) {
      return err(started.error);
    }

    await this.kitchenOrderRepo.save(started.value);
    await this.eventPublisher.publish('KITCHEN_STARTED', {
      kitchenOrderId: started.value.id,
      orderId: started.value.orderId,
      restaurantId: started.value.restaurantId,
    });

    return ok(started.value);
  }
}
