import { TableSession } from '@restaurant-os/domain';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CloseTableSessionInput {
  sessionId: string;
}

export class CloseTableSessionUseCase {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly sessionRepo: TableSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CloseTableSessionInput): Promise<Result<TableSession, Error>> {
    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) {
      return err(new Error('TableSession not found'));
    }

    let targetSession = session;
    if (targetSession.status === 'ASSIGNED') {
      const occ = targetSession.occupy();
      if (occ.success) targetSession = occ.value;
    }
    if (targetSession.status === 'OCCUPIED') {
      const op = targetSession.open();
      if (op.success) targetSession = op.value;
    }

    const requested = targetSession.requestClose();
    if (!requested.success) {
      return err(requested.error);
    }

    const closed = requested.value.close();
    if (!closed.success) {
      return err(closed.error);
    }

    const table = await this.tableRepo.findById(session.tableId);
    if (!table) {
      return err(new Error('Associated table not found'));
    }

    const released = table.release();
    if (!released.success) {
      return err(released.error);
    }

    await this.sessionRepo.save(closed.value);
    await this.tableRepo.save(released.value);
    await this.eventPublisher.publish('TABLE_CLOSED', {
      tableId: table.id,
      sessionId: session.id,
      restaurantId: table.restaurantId,
    });
    await this.eventPublisher.publish('TABLE_RELEASED', {
      tableId: table.id,
      sessionId: session.id,
      restaurantId: table.restaurantId,
    });

    return ok(closed.value);
  }
}
