import { PreOrder } from '@restaurant-os/domain';
import type { PreOrderRepository } from '../../ports/preorder-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CreatePreOrderInput {
  id: string;
  restaurantId: string;
  customerId: string;
  items?: Array<{ productId: string; quantity: number; notes?: string }>;
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
    await this.eventPublisher.publish('PREORDER_CREATED', {
      preOrderId: preOrderResult.value.id,
      restaurantId: preOrderResult.value.restaurantId,
      customerId: preOrderResult.value.customerId,
    });

    return ok(preOrderResult.value);
  }
}
