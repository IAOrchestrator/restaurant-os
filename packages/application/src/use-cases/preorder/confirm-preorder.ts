import { PreOrder } from '@restaurant-os/domain';
import type { PreOrderRepository } from '../../ports/preorder-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface ConfirmPreOrderInput {
  preOrderId: string;
}

export class ConfirmPreOrderUseCase {
  constructor(
    private readonly preOrderRepo: PreOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: ConfirmPreOrderInput): Promise<Result<PreOrder, Error>> {
    const preOrder = await this.preOrderRepo.findById(input.preOrderId);
    if (!preOrder) {
      return err(new Error('PreOrder not found'));
    }

    // Transition: DRAFT → READY → REVIEWING → CONFIRMED
    const ready = preOrder.markReady();
    if (!ready.success) return err(ready.error);

    const reviewing = ready.value.startReview();
    if (!reviewing.success) return err(reviewing.error);

    const confirmed = reviewing.value.confirm();
    if (!confirmed.success) return err(confirmed.error);

    await this.preOrderRepo.save(confirmed.value);
    await this.eventPublisher.publish('PREORDER_UPDATED', {
      preOrderId: confirmed.value.id,
      restaurantId: confirmed.value.restaurantId,
      status: confirmed.value.status,
    });

    return ok(confirmed.value);
  }
}
