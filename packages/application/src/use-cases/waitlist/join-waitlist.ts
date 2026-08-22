import { WaitlistEntry } from '@restaurant-os/domain';
import type { WaitlistRepository } from '../../ports/waitlist-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface JoinWaitlistInput {
  id: string;
  restaurantId: string;
  customerId: string;
  partySize: number;
  preOrderId?: string | null;
}

export class JoinWaitlistUseCase {
  constructor(
    private readonly waitlistRepo: WaitlistRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: JoinWaitlistInput): Promise<Result<WaitlistEntry, Error>> {
    const existing = await this.waitlistRepo.findActiveByCustomerId(input.customerId);
    if (existing) {
      return err(new Error('Customer already has an active waitlist entry'));
    }

    const entryResult = WaitlistEntry.create({
      id: input.id,
      restaurantId: input.restaurantId,
      customerId: input.customerId,
      partySize: input.partySize,
      preOrderId: input.preOrderId ?? null,
    });

    if (!entryResult.success) {
      return err(entryResult.error);
    }

    const joined = entryResult.value.joinQueue();
    if (!joined.success) {
      return err(joined.error);
    }

    await this.waitlistRepo.save(joined.value);
    await this.eventPublisher.publish('CUSTOMER_JOINED_WAITLIST', {
      entryId: joined.value.id,
      restaurantId: joined.value.restaurantId,
      customerId: joined.value.customerId,
      partySize: joined.value.partySize,
      preOrderId: joined.value.preOrderId,
    });

    return ok(joined.value);
  }
}
