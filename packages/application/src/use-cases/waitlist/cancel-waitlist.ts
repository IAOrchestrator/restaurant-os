import { WaitlistEntry } from '@restaurant-os/domain';
import type { WaitlistRepository } from '../../ports/waitlist-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CancelWaitlistInput {
  entryId: string;
}

export class CancelWaitlistUseCase {
  constructor(
    private readonly waitlistRepo: WaitlistRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CancelWaitlistInput): Promise<Result<WaitlistEntry, Error>> {
    const entry = await this.waitlistRepo.findById(input.entryId);
    if (!entry) {
      return err(new Error('Waitlist entry not found'));
    }

    const cancelled = entry.cancel();
    if (!cancelled.success) {
      return err(cancelled.error);
    }

    await this.waitlistRepo.save(cancelled.value);
    await this.eventPublisher.publish('CUSTOMER_CANCELLED_WAIT', {
      entryId: cancelled.value.id,
      restaurantId: cancelled.value.restaurantId,
      customerId: cancelled.value.customerId,
      cancelledAt: cancelled.value.cancelledAt?.toISOString(),
    });

    return ok(cancelled.value);
  }
}
