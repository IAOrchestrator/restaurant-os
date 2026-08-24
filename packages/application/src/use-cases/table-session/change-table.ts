import {
  type TableSession,
  type TableSessionId,
  EventType,
  ActorType,
  createDomainEvent,
} from '@restaurant-os/domain';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import type { TransactionRunner, TransactionContext } from '../../ports/transaction-runner';

export interface ChangeSessionTableInput {
  sessionId: TableSessionId;
  newTableId: string;
  actorId?: string | null;
}

export class ChangeSessionTableUseCase {
  constructor(
    private readonly sessionRepo: TableSessionRepository,
    private readonly tableRepo: TableRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly txRunner?: TransactionRunner,
  ) {}

  async execute(input: ChangeSessionTableInput): Promise<TableSession> {
    const executeLogic = async (repos: {
      sessionRepo: TableSessionRepository;
      tableRepo: TableRepository;
    }) => {
      const session = await repos.sessionRepo.findById(input.sessionId);
      if (!session) {
        throw new Error(`TableSession not found: ${input.sessionId}`);
      }

      const oldTableId = session.tableId;

      if (oldTableId === input.newTableId) {
        return { updatedSession: session, oldTable: null, newTable: null, oldTableId, newTableId: input.newTableId };
      }

      // Deterministic table access order by alphanumeric ID to prevent deadlocks on concurrent swaps
      const [firstTableId, secondTableId] = [oldTableId, input.newTableId].sort();
      const firstTable = await repos.tableRepo.findById(firstTableId);
      const secondTable = await repos.tableRepo.findById(secondTableId);

      const oldTable = firstTableId === oldTableId ? firstTable : secondTable;
      const newTable = firstTableId === input.newTableId ? firstTable : secondTable;

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

      // 1. Release old table if it exists
      if (oldTable) {
        const releaseResult = oldTable.release();
        if (releaseResult.success) {
          await repos.tableRepo.save(releaseResult.value);
        }
      }

      // 2. Occupy new table
      const assignResult = newTable.assign();
      if (assignResult.success) {
        const occupyResult = assignResult.value.occupy();
        if (occupyResult.success) {
          await repos.tableRepo.save(occupyResult.value);
        }
      }

      // 3. Save updated session
      await repos.sessionRepo.save(updatedSession);

      return {
        updatedSession,
        oldTable,
        newTable,
        oldTableId,
        newTableId: input.newTableId,
      };
    };

    let result: {
      updatedSession: TableSession;
      oldTable: any;
      newTable: any;
      oldTableId: string;
      newTableId: string;
    };

    if (this.txRunner) {
      result = await this.txRunner.run(async (ctx: TransactionContext) => {
        return executeLogic({
          sessionRepo: ctx.sessionRepo,
          tableRepo: ctx.tableRepo,
        });
      });
    } else {
      result = await executeLogic({
        sessionRepo: this.sessionRepo,
        tableRepo: this.tableRepo,
      });
    }

    // 4. Publish DomainEvent strictly POST-COMMIT with complete metadata
    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.TABLE_CHANGED,
        restaurantId: result.updatedSession.restaurantId,
        aggregateType: 'TableSession',
        aggregateId: result.updatedSession.id,
        tableSessionId: result.updatedSession.id,
        tableId: result.newTable?.id ?? result.newTableId,
        tableNumber: result.newTable?.number ?? null,
        actorType: ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          tableSessionId: result.updatedSession.id,
          restaurantId: result.updatedSession.restaurantId,
          oldTableId: result.oldTableId,
          oldTableNumber: result.oldTable?.number ?? null,
          newTableId: result.newTableId,
          newTableNumber: result.newTable?.number ?? null,
        },
      }),
    );

    return result.updatedSession;
  }
}
