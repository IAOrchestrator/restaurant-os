import {
  PreOrder,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { PreOrderRepository } from '../../ports/preorder-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface CancelPreOrderInput {
  preOrderId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class CancelPreOrderUseCase {
  constructor(
    private readonly preOrderRepo: PreOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CancelPreOrderInput): Promise<Result<PreOrder, Error>> {
    const preOrder = await this.preOrderRepo.findById(input.preOrderId);
    if (!preOrder) {
      return err(new Error('PreOrder not found'));
    }

    const cancelled = preOrder.cancel();
    if (!cancelled.success) {
      return err(cancelled.error);
    }

    await this.preOrderRepo.save(cancelled.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.PREORDER_UPDATED,
        restaurantId: cancelled.value.restaurantId,
        aggregateType: 'PreOrder',
        aggregateId: cancelled.value.id,
        actorType: input.actorType ?? ActorType.CUSTOMER,
        actorId: input.actorId ?? cancelled.value.customerId,
        payload: {
          preOrderId: cancelled.value.id,
          restaurantId: cancelled.value.restaurantId,
          status: cancelled.value.status,
        },
      }),
    );

    return ok(cancelled.value);
  }
}
