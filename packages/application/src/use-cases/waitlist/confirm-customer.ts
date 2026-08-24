import {
  WaitlistEntry,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { WaitlistRepository } from '../../ports/waitlist-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface ConfirmCustomerInput {
  entryId: string;
  actorType?: ActorType;
  actorId?: string | null;
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

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.CUSTOMER_CONFIRMED,
        restaurantId: confirmed.value.restaurantId,
        aggregateType: 'WaitlistEntry',
        aggregateId: confirmed.value.id,
        actorType: input.actorType ?? ActorType.CUSTOMER,
        actorId: input.actorId ?? confirmed.value.customerId,
        payload: {
          entryId: confirmed.value.id,
          restaurantId: confirmed.value.restaurantId,
          customerId: confirmed.value.customerId,
          confirmedAt: confirmed.value.updatedAt.toISOString(),
        },
      }),
    );

    return ok(confirmed.value);
  }
}
