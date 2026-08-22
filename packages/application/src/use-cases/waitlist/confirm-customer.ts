import { WaitlistEntry } from '@restaurant-os/domain';
import type { WaitlistRepository } from '../../ports/waitlist-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface ConfirmCustomerInput {
  entryId: string;
}

export class ConfirmCustomerUseCase {
  constructor(
    private readonly waitlistRepo: WaitlistRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: ConfirmCustomerInput): Promise<Result<WaitlistEntry, Error>> {
    const entry = await this.waitlistRepo.findById(input.entryId);
    if (!entry) {
      return err(new Error('Waitlist entry not found'));
    }

    const confirmed = entry.confirm();
    if (!confirmed.success) {
      return err(confirmed.error);
    }

    await this.waitlistRepo.save(confirmed.value);
    await this.eventPublisher.publish('CUSTOMER_CONFIRMED', {
      entryId: confirmed.value.id,
      restaurantId: confirmed.value.restaurantId,
      customerId: confirmed.value.customerId,
    });

    return ok(confirmed.value);
  }
}
