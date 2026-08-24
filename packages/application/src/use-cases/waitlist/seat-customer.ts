import {
  WaitlistEntry,
  WaitlistStatus,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { WaitlistRepository } from '../../ports/waitlist-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface SeatCustomerInput {
  entryId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class SeatCustomerUseCase {
  constructor(
    private readonly waitlistRepo: WaitlistRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: SeatCustomerInput): Promise<Result<WaitlistEntry, Error>> {
    const entry = await this.waitlistRepo.findById(input.entryId);
    if (!entry) {
      return err(new Error('Waitlist entry not found'));
    }

    let current = entry;
    if (current.status === WaitlistStatus.WAITING) {
      const called = current.call();
      if (!called.success) return err(called.error);
      current = called.value;
    }
    if (current.status === WaitlistStatus.CALLED) {
      const confirmed = current.confirm();
      if (!confirmed.success) return err(confirmed.error);
      current = confirmed.value;
    }
    if (current.status === WaitlistStatus.CUSTOMER_CONFIRMED) {
      const waiting = current.markWaitingForSeating();
      if (!waiting.success) return err(waiting.error);
      current = waiting.value;
    }
    if (current.status === WaitlistStatus.WAITING_FOR_SEATING) {
      const seated = current.seat();
      if (!seated.success) return err(seated.error);
      current = seated.value;
    }

    await this.waitlistRepo.save(current);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.CUSTOMER_SEATED,
        restaurantId: current.restaurantId,
        aggregateType: 'WaitlistEntry',
        aggregateId: current.id,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          entryId: current.id,
          restaurantId: current.restaurantId,
          customerId: current.customerId,
          seatedAt: current.seatedAt?.toISOString(),
        },
      }),
    );

    return ok(current);
  }
}
