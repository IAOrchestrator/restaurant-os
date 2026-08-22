import { TableSession } from '@restaurant-os/domain';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface ChangeWaiterInput {
  sessionId: string;
  newWaiterId: string;
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

    const changed = session.changeWaiter(input.newWaiterId);
    if (!changed.success) {
      return err(changed.error);
    }

    await this.sessionRepo.save(changed.value);
    await this.eventPublisher.publish('WAITER_CHANGED', {
      sessionId: session.id,
      restaurantId: session.restaurantId,
      previousWaiterId: session.currentWaiterId,
      newWaiterId: input.newWaiterId,
    });

    return ok(changed.value);
  }
}
