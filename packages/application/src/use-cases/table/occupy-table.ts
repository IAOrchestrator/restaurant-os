import { Table, TableSession } from '@restaurant-os/domain';
import type { TableRepository } from '../../ports/table-repository';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface OccupyTableInput {
  tableId: string;
  sessionId: string;
}

export class OccupyTableUseCase {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly sessionRepo: TableSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: OccupyTableInput): Promise<Result<{ table: Table; session: TableSession }, Error>> {
    const table = await this.tableRepo.findById(input.tableId);
    if (!table) {
      return err(new Error('Table not found'));
    }

    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) {
      return err(new Error('TableSession not found'));
    }

    if (session.tableId !== table.id) {
      return err(new Error('Session does not belong to this table'));
    }

    const occupiedTable = table.occupy();
    if (!occupiedTable.success) {
      return err(occupiedTable.error);
    }

    const occupiedSession = session.occupy();
    if (!occupiedSession.success) {
      return err(occupiedSession.error);
    }

    await this.tableRepo.save(occupiedTable.value);
    await this.sessionRepo.save(occupiedSession.value);
    await this.eventPublisher.publish('CUSTOMER_SEATED', {
      tableId: table.id,
      sessionId: session.id,
      restaurantId: table.restaurantId,
    });

    return ok({ table: occupiedTable.value, session: occupiedSession.value });
  }
}
