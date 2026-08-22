import { WaitlistEntry } from '@restaurant-os/domain';
import type { WaitlistRepository } from '../../ports/waitlist-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface SelectTakeawayInput {
  entryId: string;
}

export class SelectTakeawayUseCase {
  constructor(
    private readonly waitlistRepo: WaitlistRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: SelectTakeawayInput): Promise<Result<WaitlistEntry, Error>> {
    const entry = await this.waitlistRepo.findById(input.entryId);
    if (!entry) {
      return err(new Error('Waitlist entry not found'));
    }

    const takeaway = entry.selectTakeaway();
    if (!takeaway.success) {
      return err(takeaway.error);
    }

    await this.waitlistRepo.save(takeaway.value);
    await this.eventPublisher.publish('CUSTOMER_SELECTED_TAKEAWAY', {
      entryId: takeaway.value.id,
      restaurantId: takeaway.value.restaurantId,
      customerId: takeaway.value.customerId,
    });

    return ok(takeaway.value);
  }
}
