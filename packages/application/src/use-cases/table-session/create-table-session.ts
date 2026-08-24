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

export interface CreateTableSessionInput {
  id: string;
  restaurantId: string;
  tableId: string;
  initialWaiterId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class CreateTableSessionUseCase {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly sessionRepo: TableSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateTableSessionInput): Promise<Result<TableSession, Error>> {
    const table = await this.tableRepo.findById(input.tableId);
    if (!table) {
      return err(new Error('Table not found'));
    }

    const activeSession = await this.sessionRepo.findActiveByTableId(input.tableId);
    if (activeSession) {
      return err(new Error('Table already has an active session'));
    }

    const session = TableSession.create({
      id: input.id,
      restaurantId: input.restaurantId,
      tableId: input.tableId,
      initialWaiterId: input.initialWaiterId,
    });

    if (!session.success) {
      return err(session.error);
    }

    const occupiedTable = table.occupy();
    if (occupiedTable.success) {
      await this.tableRepo.save(occupiedTable.value);
    }

    await this.sessionRepo.save(session.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.TABLE_ASSIGNED,
        restaurantId: input.restaurantId,
        aggregateType: 'TableSession',
        aggregateId: session.value.id,
        tableSessionId: session.value.id,
        tableId: input.tableId,
        tableNumber: table.number,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? input.initialWaiterId,
        payload: {
          sessionId: input.id,
          tableId: input.tableId,
          tableNumber: table.number,
          restaurantId: input.restaurantId,
          waiterId: input.initialWaiterId,
        },
      }),
    );

    return ok(session.value);
  }
}
