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
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface CloseTableSessionInput {
  sessionId: string;
  actorType?: ActorType;
  actorId?: string | null;
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

    // 1. TABLE_CLOSED
    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.TABLE_CLOSED,
        restaurantId: table.restaurantId,
        aggregateType: 'TableSession',
        aggregateId: session.id,
        tableSessionId: session.id,
        tableId: table.id,
        tableNumber: table.number,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          tableId: table.id,
          sessionId: session.id,
          tableSessionId: session.id,
          tableNumber: table.number,
          restaurantId: table.restaurantId,
        },
      }),
    );

    // 2. TABLE_RELEASED
    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.TABLE_RELEASED,
        restaurantId: table.restaurantId,
        aggregateType: 'Table',
        aggregateId: table.id,
        tableSessionId: session.id,
        tableId: table.id,
        tableNumber: table.number,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          tableId: table.id,
          tableNumber: table.number,
          sessionId: session.id,
          tableSessionId: session.id,
          restaurantId: table.restaurantId,
        },
      }),
    );

    return ok(closed.value);
  }
}
