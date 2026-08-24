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

export interface CancelOrderInput {
  orderId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class CancelOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CancelOrderInput): Promise<Result<Order, Error>> {
    const order = await this.orderRepo.findById(input.orderId);
    if (!order) {
      return err(new Error('Order not found'));
    }

    const cancelled = order.cancel();
    if (!cancelled.success) {
      return err(cancelled.error);
    }

    await this.orderRepo.save(cancelled.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.ORDER_CANCELLED,
        restaurantId: cancelled.value.restaurantId,
        aggregateType: 'Order',
        aggregateId: cancelled.value.id,
        tableSessionId: cancelled.value.tableSessionId,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          orderId: cancelled.value.id,
          restaurantId: cancelled.value.restaurantId,
          tableSessionId: cancelled.value.tableSessionId,
        },
      }),
    );

    return ok(cancelled.value);
  }
}
