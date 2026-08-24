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

export interface CancelWaitlistInput {
  entryId: string;
  actorType?: ActorType;
  actorId?: string | null;
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

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.CUSTOMER_CANCELLED_WAIT,
        restaurantId: cancelled.value.restaurantId,
        aggregateType: 'WaitlistEntry',
        aggregateId: cancelled.value.id,
        actorType: input.actorType ?? ActorType.CUSTOMER,
        actorId: input.actorId ?? cancelled.value.customerId,
        payload: {
          entryId: cancelled.value.id,
          restaurantId: cancelled.value.restaurantId,
          customerId: cancelled.value.customerId,
        },
      }),
    );

    return ok(cancelled.value);
  }
}
