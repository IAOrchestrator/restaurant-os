import {
  TableSession,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface ChangeWaiterInput {
  sessionId: string;
  newWaiterId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class ChangeWaiterUseCase {
  constructor(
    private readonly sessionRepo: TableSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: ChangeWaiterInput): Promise<Result<TableSession, Error>> {
    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) {
      return err(new Error('TableSession not found'));
    }

    const previousWaiterId = session.currentWaiterId;
    const changed = session.changeWaiter(input.newWaiterId);
    if (!changed.success) {
      return err(changed.error);
    }

    await this.sessionRepo.save(changed.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.WAITER_CHANGED,
        restaurantId: session.restaurantId,
        aggregateType: 'TableSession',
        aggregateId: session.id,
        tableSessionId: session.id,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? input.newWaiterId,
        payload: {
          sessionId: session.id,
          tableSessionId: session.id,
          restaurantId: session.restaurantId,
          previousWaiterId,
          newWaiterId: input.newWaiterId,
        },
      }),
    );

    return ok(changed.value);
  }
}
