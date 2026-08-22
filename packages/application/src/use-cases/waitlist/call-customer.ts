import { WaitlistEntry } from '@restaurant-os/domain';
import type { WaitlistRepository } from '../../ports/waitlist-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CallCustomerInput {
  entryId: string;
}

export class CallCustomerUseCase {
  constructor(
    private readonly waitlistRepo: WaitlistRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CallCustomerInput): Promise<Result<WaitlistEntry, Error>> {
    const entry = await this.waitlistRepo.findById(input.entryId);
    if (!entry) {
      return err(new Error('Waitlist entry not found'));
    }

    const called = entry.call();
    if (!called.success) {
      return err(called.error);
    }

    await this.waitlistRepo.save(called.value);
    await this.eventPublisher.publish('CUSTOMER_CALLED', {
      entryId: called.value.id,
      restaurantId: called.value.restaurantId,
      customerId: called.value.customerId,
      calledAt: called.value.calledAt?.toISOString(),
    });

    return ok(called.value);
  }
}
