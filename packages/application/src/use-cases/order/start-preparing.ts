import {
  Order,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { OrderRepository } from '../../ports/order-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface StartPreparingInput {
  orderId: string;
  actorType?: ActorType;
  actorId?: string | null;
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

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.KITCHEN_STARTED,
        restaurantId: preparing.value.restaurantId,
        aggregateType: 'Order',
        aggregateId: preparing.value.id,
        tableSessionId: preparing.value.tableSessionId,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          orderId: preparing.value.id,
          restaurantId: preparing.value.restaurantId,
          tableSessionId: preparing.value.tableSessionId,
        },
      }),
    );

    return ok(preparing.value);
  }
}
