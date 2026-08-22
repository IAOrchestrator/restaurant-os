import { TableSession } from '@restaurant-os/domain';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CreateTableSessionInput {
  id: string;
  restaurantId: string;
  tableId: string;
  initialWaiterId: string;
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
    await this.eventPublisher.publish('TABLE_ASSIGNED', {
      tableId: input.tableId,
      sessionId: input.id,
      restaurantId: input.restaurantId,
      waiterId: input.initialWaiterId,
    });

    return ok(session.value);
  }
}
