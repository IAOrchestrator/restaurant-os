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

export interface CreateKitchenOrderInput {
  id: string;
  restaurantId: string;
  orderId: string;
  assignedTo?: string | null;
  priority?: number;
  notes?: string | null;
  actorType?: ActorType;
  actorId?: string | null;
}

export class CreateKitchenOrderUseCase {
  constructor(
    private readonly kitchenOrderRepo: KitchenOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateKitchenOrderInput): Promise<Result<KitchenOrder, Error>> {
    const existing = await this.kitchenOrderRepo.findByOrderId(input.orderId);
    if (existing) {
      return err(new Error('Kitchen order already exists for this order'));
    }

    const result = KitchenOrder.create({
      id: input.id,
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      assignedTo: input.assignedTo,
      priority: input.priority,
      notes: input.notes,
    });

    if (!result.success) {
      return err(result.error);
    }

    await this.kitchenOrderRepo.save(result.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.KITCHEN_RECEIVED,
        restaurantId: result.value.restaurantId,
        aggregateType: 'KitchenOrder',
        aggregateId: result.value.id,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          kitchenOrderId: result.value.id,
          orderId: result.value.orderId,
          restaurantId: result.value.restaurantId,
        },
      }),
    );

    return ok(result.value);
  }
}
