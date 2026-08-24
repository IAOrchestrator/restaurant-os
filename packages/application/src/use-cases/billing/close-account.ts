import {
  Account,
  AccountStatus,
  TableSession,
  TableSessionStatus,
  Table,
  TableStatus,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { AccountRepository } from '../../ports/account-repository';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import type { TransactionRunner } from '../../ports/transaction-runner';

export interface CloseAccountInput {
  accountId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class CloseAccountUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly sessionRepo?: TableSessionRepository,
    private readonly tableRepo?: TableRepository,
    private readonly txRunner?: TransactionRunner,
  ) {}

  async execute(input: CloseAccountInput): Promise<Result<Account, Error>> {
    const executeLogic = async (repos: {
      accountRepo: AccountRepository;
      sessionRepo?: TableSessionRepository;
      tableRepo?: TableRepository;
    }) => {
      // 1. Fetch Account (Deterministic order: Account -> TableSession -> Table)
      const account = await repos.accountRepo.findById(input.accountId);
      if (!account) {
        return err(new Error('Account not found'));
      }

      // Check session & table repositories
      const sessionRepo = repos.sessionRepo ?? this.sessionRepo;
      const tableRepo = repos.tableRepo ?? this.tableRepo;

      // 2. Fetch TableSession
      let session: TableSession | null = null;
      let table: Table | null = null;

      if (sessionRepo && account.tableSessionId) {
        session = await sessionRepo.findById(account.tableSessionId);
        if (!session) {
          return err(new Error(`Associated TableSession not found: ${account.tableSessionId}`));
        }
        if (tableRepo && session.tableId) {
          table = await tableRepo.findById(session.tableId);
          if (!table) {
            return err(new Error(`Associated Table not found: ${session.tableId}`));
          }
        }
      }

      // 3. Idempotency & Inconsistent State Detection
      if (account.status === AccountStatus.CLOSED) {
        const isSessionClosed = !session || session.status === TableSessionStatus.CLOSED;
        const isTableAvailable = !table || table.status === TableStatus.AVAILABLE;

        if (isSessionClosed && isTableAvailable) {
          // Idempotent retry: everything is already cleanly closed
          return ok({
            account,
            session,
            table,
            isRetry: true,
          });
        }

        // Inconsistent state: fail explicitly, do NOT repair silently
        return err(
          new Error(
            `Inconsistent state detected: Account ${account.id} is CLOSED, but TableSession (${session?.status ?? 'none'}) or Table (${table?.status ?? 'none'}) is not closed/available. Manual inspection required.`,
          ),
        );
      }

      // 4. Validate Account payment status
      if (account.status !== AccountStatus.PAID && !account.isFullyPaid) {
        return err(
          new Error(
            `Cannot close account: current status is ${account.status} (expected PAID, balance remaining: ${account.remainingAmount})`,
          ),
        );
      }

      // 5. Close Account
      const closedAccountRes = account.close();
      if (!closedAccountRes.success) {
        return err(closedAccountRes.error);
      }
      const closedAccount = closedAccountRes.value;

      // 6. Close TableSession
      let closedSession: TableSession | null = null;
      if (session && sessionRepo) {
        let targetSession = session;
        if (targetSession.status === TableSessionStatus.ASSIGNED) {
          const occ = targetSession.occupy();
          if (occ.success) targetSession = occ.value;
        }
        if (targetSession.status === TableSessionStatus.OCCUPIED) {
          const op = targetSession.open();
          if (op.success) targetSession = op.value;
        }
        if (targetSession.status === TableSessionStatus.OPEN) {
          const req = targetSession.requestClose();
          if (req.success) targetSession = req.value;
        }
        if (targetSession.status === TableSessionStatus.CLOSING) {
          const cl = targetSession.close();
          if (!cl.success) {
            return err(cl.error);
          }
          closedSession = cl.value;
          await sessionRepo.save(closedSession);
        } else if (targetSession.status === TableSessionStatus.CLOSED) {
          closedSession = targetSession;
        }
      }

      // 7. Release Table
      let releasedTable: Table | null = null;
      if (table && tableRepo) {
        if (table.status === TableStatus.OCCUPIED || table.status === TableStatus.ASSIGNED) {
          const rel = table.release();
          if (!rel.success) {
            return err(rel.error);
          }
          releasedTable = rel.value;
          await tableRepo.save(releasedTable);
        } else if (table.status === TableStatus.AVAILABLE) {
          releasedTable = table;
        }
      }

      // Save closed Account
      await repos.accountRepo.save(closedAccount);

      return ok({
        account: closedAccount,
        session: closedSession,
        table: releasedTable,
        isRetry: false,
      });
    };

    let result: {
      account: Account;
      session: TableSession | null;
      table: Table | null;
      isRetry: boolean;
    };

    if (this.txRunner) {
      const txRes = await this.txRunner.run(async (ctx) => {
        return executeLogic({
          accountRepo: ctx.accountRepo,
          sessionRepo: ctx.sessionRepo,
          tableRepo: ctx.tableRepo,
        });
      });
      if (!txRes.success) return err(txRes.error);
      result = txRes.value;
    } else {
      const res = await executeLogic({
        accountRepo: this.accountRepo,
        sessionRepo: this.sessionRepo,
        tableRepo: this.tableRepo,
      });
      if (!res.success) return err(res.error);
      result = res.value;
    }

    // 8. Strictly POST-COMMIT Event Publishing (skipped on idempotent retry)
    if (!result.isRetry) {
      // 8.1. ACCOUNT_CLOSED
      await this.eventPublisher.publish(
        createDomainEvent({
          type: EventType.ACCOUNT_CLOSED,
          restaurantId: result.account.restaurantId,
          aggregateType: 'Account',
          aggregateId: result.account.id,
          tableSessionId: result.account.tableSessionId,
          tableId: result.table?.id ?? null,
          tableNumber: result.table?.number ?? null,
          actorType: input.actorType ?? ActorType.STAFF,
          actorId: input.actorId ?? null,
          payload: {
            accountId: result.account.id,
            restaurantId: result.account.restaurantId,
            tableSessionId: result.account.tableSessionId,
            tableId: result.table?.id ?? null,
            tableNumber: result.table?.number ?? null,
            totalAmount: result.account.totalAmount,
            paidAmount: result.account.paidAmount,
          },
        }),
      );

      // 8.2. TABLE_CLOSED
      if (result.session) {
        await this.eventPublisher.publish(
          createDomainEvent({
            type: EventType.TABLE_CLOSED,
            restaurantId: result.session.restaurantId,
            aggregateType: 'TableSession',
            aggregateId: result.session.id,
            tableSessionId: result.session.id,
            tableId: result.table?.id ?? null,
            tableNumber: result.table?.number ?? null,
            actorType: input.actorType ?? ActorType.STAFF,
            actorId: input.actorId ?? null,
            payload: {
              tableSessionId: result.session.id,
              tableId: result.table?.id ?? null,
              tableNumber: result.table?.number ?? null,
              restaurantId: result.session.restaurantId,
            },
          }),
        );
      }

      // 8.3. TABLE_RELEASED
      if (result.table) {
        await this.eventPublisher.publish(
          createDomainEvent({
            type: EventType.TABLE_RELEASED,
            restaurantId: result.table.restaurantId,
            aggregateType: 'Table',
            aggregateId: result.table.id,
            tableSessionId: result.session?.id ?? null,
            tableId: result.table.id,
            tableNumber: result.table.number,
            actorType: input.actorType ?? ActorType.STAFF,
            actorId: input.actorId ?? null,
            payload: {
              tableId: result.table.id,
              tableNumber: result.table.number,
              tableSessionId: result.session?.id ?? null,
              restaurantId: result.table.restaurantId,
            },
          }),
        );
      }
    }

    return ok(result.account);
  }
}
