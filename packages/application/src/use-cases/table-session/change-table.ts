import {
  type TableSession,
  type TableSessionId,
  EventType,
} from '@restaurant-os/domain';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface ChangeSessionTableInput {
  sessionId: TableSessionId;
  newTableId: string;
}

export class ChangeSessionTableUseCase {
  constructor(
    private readonly sessionRepo: TableSessionRepository,
    private readonly tableRepo: TableRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: ChangeSessionTableInput): Promise<TableSession> {
    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) {
      throw new Error(`TableSession not found: ${input.sessionId}`);
    }

    const oldTableId = session.tableId;
    const oldTable = await this.tableRepo.findById(oldTableId);

    const newTable = await this.tableRepo.findById(input.newTableId);
    if (!newTable) {
      throw new Error(`Target table not found: ${input.newTableId}`);
    }

    if (newTable.restaurantId !== session.restaurantId) {
      throw new Error('Target table belongs to a different restaurant');
    }

    if (newTable.status !== 'AVAILABLE') {
      throw new Error(`Target table is not available (current status: ${newTable.status})`);
    }

    const changeResult = session.changeTable(input.newTableId);
    if (!changeResult.success) {
      throw changeResult.error;
    }
    const updatedSession = changeResult.value;

    // Release old table if it exists
    if (oldTable) {
      const releaseResult = oldTable.release();
      if (releaseResult.success) {
        await this.tableRepo.save(releaseResult.value);
      }
    }

    // Occupy new table
    const assignResult = newTable.assign();
    if (assignResult.success) {
      const occupyResult = assignResult.value.occupy();
      if (occupyResult.success) {
        await this.tableRepo.save(occupyResult.value);
      }
    }

    await this.sessionRepo.save(updatedSession);

    await this.eventPublisher.publish(EventType.TABLE_CHANGED, {
      tableSessionId: updatedSession.id,
      restaurantId: updatedSession.restaurantId,
      oldTableId,
      newTableId: input.newTableId,
      aggregateType: 'TableSession',
      aggregateId: updatedSession.id,
    });

    return updatedSession;
  }
}
