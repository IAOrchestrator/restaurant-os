import {
  KitchenOrder,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { KitchenOrderRepository } from '../../ports/kitchen-order-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface CompleteKitchenOrderInput {
  kitchenOrderId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class CompleteKitchenOrderUseCase {
  constructor(
    private readonly kitchenOrderRepo: KitchenOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CompleteKitchenOrderInput): Promise<Result<KitchenOrder, Error>> {
    const kitchenOrder = await this.kitchenOrderRepo.findById(input.kitchenOrderId);
    if (!kitchenOrder) {
      return err(new Error('Kitchen order not found'));
    }

    const completed = kitchenOrder.complete();
    if (!completed.success) {
      return err(completed.error);
    }

    await this.kitchenOrderRepo.save(completed.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.ORDER_DELIVERED,
        restaurantId: completed.value.restaurantId,
        aggregateType: 'KitchenOrder',
        aggregateId: completed.value.id,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          kitchenOrderId: completed.value.id,
          orderId: completed.value.orderId,
          restaurantId: completed.value.restaurantId,
        },
      }),
    );

    return ok(completed.value);
  }
}
