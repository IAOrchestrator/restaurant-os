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

export interface AssignKitchenOrderInput {
  kitchenOrderId: string;
  staffId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class AssignKitchenOrderUseCase {
  constructor(
    private readonly kitchenOrderRepo: KitchenOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: AssignKitchenOrderInput): Promise<Result<KitchenOrder, Error>> {
    const kitchenOrder = await this.kitchenOrderRepo.findById(input.kitchenOrderId);
    if (!kitchenOrder) {
      return err(new Error('Kitchen order not found'));
    }

    const assigned = kitchenOrder.assign(input.staffId);
    if (!assigned.success) {
      return err(assigned.error);
    }

    await this.kitchenOrderRepo.save(assigned.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.KITCHEN_ORDER_ASSIGNED,
        restaurantId: assigned.value.restaurantId,
        aggregateType: 'KitchenOrder',
        aggregateId: assigned.value.id,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? input.staffId,
        payload: {
          kitchenOrderId: assigned.value.id,
          orderId: assigned.value.orderId,
          assignedTo: input.staffId,
          restaurantId: assigned.value.restaurantId,
        },
      }),
    );

    return ok(assigned.value);
  }
}
