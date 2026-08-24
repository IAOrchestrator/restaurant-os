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

export interface CallCustomerInput {
  entryId: string;
  actorType?: ActorType;
  actorId?: string | null;
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

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.CUSTOMER_CALLED,
        restaurantId: called.value.restaurantId,
        aggregateType: 'WaitlistEntry',
        aggregateId: called.value.id,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          entryId: called.value.id,
          restaurantId: called.value.restaurantId,
          customerId: called.value.customerId,
          calledAt: called.value.calledAt?.toISOString(),
        },
      }),
    );

    return ok(called.value);
  }
}
