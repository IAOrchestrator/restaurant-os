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

export interface MarkOrderReadyInput {
  orderId: string;
  actorType?: ActorType;
  actorId?: string | null;
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

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.ORDER_READY,
        restaurantId: ready.value.restaurantId,
        aggregateType: 'Order',
        aggregateId: ready.value.id,
        tableSessionId: ready.value.tableSessionId,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          orderId: ready.value.id,
          restaurantId: ready.value.restaurantId,
          tableSessionId: ready.value.tableSessionId,
        },
      }),
    );

    return ok(ready.value);
  }
}
