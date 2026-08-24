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

export interface CreatePreOrderInput {
  id: string;
  restaurantId: string;
  customerId: string;
  items?: Array<{ productId: string; quantity: number; notes?: string }>;
  actorType?: ActorType;
  actorId?: string | null;
}

export class CreatePreOrderUseCase {
  constructor(
    private readonly preOrderRepo: PreOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreatePreOrderInput): Promise<Result<PreOrder, Error>> {
    const preOrderResult = PreOrder.create({
      id: input.id,
      restaurantId: input.restaurantId,
      customerId: input.customerId,
      items: input.items ?? [],
    });

    if (!preOrderResult.success) {
      return err(preOrderResult.error);
    }

    await this.preOrderRepo.save(preOrderResult.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.PREORDER_CREATED,
        restaurantId: preOrderResult.value.restaurantId,
        aggregateType: 'PreOrder',
        aggregateId: preOrderResult.value.id,
        actorType: input.actorType ?? ActorType.CUSTOMER,
        actorId: input.actorId ?? input.customerId,
        payload: {
          preOrderId: preOrderResult.value.id,
          restaurantId: preOrderResult.value.restaurantId,
          customerId: preOrderResult.value.customerId,
        },
      }),
    );

    return ok(preOrderResult.value);
  }
}
