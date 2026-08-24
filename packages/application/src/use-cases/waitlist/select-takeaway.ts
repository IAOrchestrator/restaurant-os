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

export interface SelectTakeawayInput {
  entryId: string;
  actorType?: ActorType;
  actorId?: string | null;
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

    const selected = entry.selectTakeaway();
    if (!selected.success) {
      return err(selected.error);
    }

    await this.waitlistRepo.save(selected.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.CUSTOMER_SELECTED_TAKEAWAY,
        restaurantId: selected.value.restaurantId,
        aggregateType: 'WaitlistEntry',
        aggregateId: selected.value.id,
        actorType: input.actorType ?? ActorType.CUSTOMER,
        actorId: input.actorId ?? selected.value.customerId,
        payload: {
          entryId: selected.value.id,
          restaurantId: selected.value.restaurantId,
          customerId: selected.value.customerId,
        },
      }),
    );

    return ok(selected.value);
  }
}
