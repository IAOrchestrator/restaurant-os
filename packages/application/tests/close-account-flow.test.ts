import { describe, it, expect, vi } from 'vitest';
import {
  Account,
  AccountStatus,
  TableSession,
  TableSessionStatus,
  Table,
  TableStatus,
  EventType,
  ActorType,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import {
  CloseAccountUseCase,
  CloseTableSessionUseCase,
  type AccountRepository,
  type TableSessionRepository,
  type TableRepository,
  type OrderRepository,
  type KitchenOrderRepository,
  type EventPublisher,
  type TransactionRunner,
  type TransactionContext,
} from '../src';

// --- In-Memory Test Doubles ---
class InMemoryAccountRepository implements AccountRepository {
  public accounts = new Map<string, Account>();
  async findById(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }
  async findByTableSessionId(tableSessionId: string): Promise<Account | null> {
    for (const acc of this.accounts.values()) {
      if (acc.tableSessionId === tableSessionId) return acc;
    }
    return null;
  }
  async findByRestaurantId(restaurantId: string): Promise<Account[]> {
    return Array.from(this.accounts.values()).filter((a) => a.restaurantId === restaurantId);
  }
  async save(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }
}

class InMemoryTableSessionRepository implements TableSessionRepository {
  public sessions = new Map<string, TableSession>();
  async findById(id: string): Promise<TableSession | null> {
    return this.sessions.get(id) ?? null;
  }
  async findActiveByTableId(tableId: string): Promise<TableSession | null> {
    for (const s of this.sessions.values()) {
      if (s.tableId === tableId && s.status !== TableSessionStatus.CLOSED) {
        return s;
      }
    }
    return null;
  }
  async findByRestaurantId(restaurantId: string): Promise<TableSession[]> {
    return Array.from(this.sessions.values()).filter((s) => s.restaurantId === restaurantId);
  }
  async save(session: TableSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
}

class InMemoryTableRepository implements TableRepository {
  public tables = new Map<string, Table>();
  async findById(id: string): Promise<Table | null> {
    return this.tables.get(id) ?? null;
  }
  async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
    for (const t of this.tables.values()) {
      if (t.restaurantId === restaurantId && t.number === number) return t;
    }
    return null;
  }
  async findByRestaurantId(restaurantId: string): Promise<Table[]> {
    return Array.from(this.tables.values()).filter((t) => t.restaurantId === restaurantId);
  }
  async save(table: Table): Promise<void> {
    this.tables.set(table.id, table);
  }
}

class MockEventPublisher implements EventPublisher {
  public events: any[] = [];
  async publish(eventOrType: any, payload?: any): Promise<void> {
    if (typeof eventOrType === 'string') {
      this.events.push({ type: eventOrType, eventType: eventOrType, payload });
    } else {
      this.events.push({ ...eventOrType, eventType: eventOrType.type });
    }
  }
}

class SnapshottingTransactionRunner implements TransactionRunner {
  constructor(
    private readonly accountRepo: InMemoryAccountRepository,
    private readonly sessionRepo: InMemoryTableSessionRepository,
    private readonly tableRepo: InMemoryTableRepository,
    public simulateFailure = false,
  ) {}

  async run<T>(action: (ctx: TransactionContext) => Promise<Result<T, Error>>): Promise<Result<T, Error>> {
    // Snapshot state
    const accountSnapshot = new Map(this.accountRepo.accounts);
    const sessionSnapshot = new Map(this.sessionRepo.sessions);
    const tableSnapshot = new Map(this.tableRepo.tables);

    const ctx: TransactionContext = {
      accountRepo: this.accountRepo,
      sessionRepo: this.sessionRepo,
      tableRepo: this.tableRepo,
      orderRepo: {} as OrderRepository,
      kitchenOrderRepo: {} as KitchenOrderRepository,
    };

    try {
      if (this.simulateFailure) {
        throw new Error('Simulated Database Transaction Failure');
      }

      const result = await action(ctx);
      if (!result.success) {
        // Rollback state on domain failure
        this.accountRepo.accounts = accountSnapshot;
        this.sessionRepo.sessions = sessionSnapshot;
        this.tableRepo.tables = tableSnapshot;
        return result;
      }
      return result;
    } catch (error: any) {
      // Rollback state on error
      this.accountRepo.accounts = accountSnapshot;
      this.sessionRepo.sessions = sessionSnapshot;
      this.tableRepo.tables = tableSnapshot;
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

describe('CloseAccountUseCase — Transactional Account & Table Closing (Step 1.4)', () => {
  const REST_ID = '550e8400-e29b-41d4-a716-446655440001';
  const TABLE_ID = '550e8400-e29b-41d4-a716-446655440010';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440020';
  const ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440030';

  function setupEnvironment() {
    const accountRepo = new InMemoryAccountRepository();
    const sessionRepo = new InMemoryTableSessionRepository();
    const tableRepo = new InMemoryTableRepository();
    const eventPublisher = new MockEventPublisher();
    const txRunner = new SnapshottingTransactionRunner(accountRepo, sessionRepo, tableRepo);

    // Seed Table (OCCUPIED, number 12)
    const table = Table.create({
      id: TABLE_ID,
      restaurantId: REST_ID,
      number: 12,
      capacity: 4,
    }).value!.occupy().value!;
    tableRepo.tables.set(table.id, table);

    // Seed TableSession (OPEN)
    const session = TableSession.create({
      id: SESSION_ID,
      restaurantId: REST_ID,
      tableId: TABLE_ID,
    }).value!.occupy().value!.open().value!;
    sessionRepo.sessions.set(session.id, session);

    // Seed Account (PAID: total 150, paid 150)
    const account = Account.create({
      id: ACCOUNT_ID,
      restaurantId: REST_ID,
      tableSessionId: SESSION_ID,
    }).value!
      .addOrderAmount(150).value!
      .requestPayment().value!
      .registerPayment({
        id: 'pay-1',
        amount: 150,
        method: 'card',
        registeredAt: new Date(),
      }).value!;
    accountRepo.accounts.set(account.id, account);

    return { accountRepo, sessionRepo, tableRepo, eventPublisher, txRunner };
  }

  // 1. Cierre exitoso de las tres entidades
  it('1. Closes Account, TableSession and Table atomically in a single transaction', async () => {
    const env = setupEnvironment();
    const useCase = new CloseAccountUseCase(
      env.accountRepo,
      env.eventPublisher,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const result = await useCase.execute({
      accountId: ACCOUNT_ID,
      actorType: ActorType.STAFF,
      actorId: 'cashier-001',
    });

    expect(result.success).toBe(true);
    expect(result.value?.status).toBe(AccountStatus.CLOSED);

    // Check TableSession status
    const session = await env.sessionRepo.findById(SESSION_ID);
    expect(session?.status).toBe(TableSessionStatus.CLOSED);

    // Check Table status
    const table = await env.tableRepo.findById(TABLE_ID);
    expect(table?.status).toBe(TableStatus.AVAILABLE);

    // Check 3 post-commit events published
    expect(env.eventPublisher.events).toHaveLength(3);
    expect(env.eventPublisher.events[0].eventType).toBe(EventType.ACCOUNT_CLOSED);
    expect(env.eventPublisher.events[1].eventType).toBe(EventType.TABLE_CLOSED);
    expect(env.eventPublisher.events[2].eventType).toBe(EventType.TABLE_RELEASED);
  });

  // 2. Rollback completo ante fallo
  it('2. Performs complete rollback of all 3 entities and emits NO events if transaction fails', async () => {
    const env = setupEnvironment();
    env.txRunner.simulateFailure = true; // Trigger database error

    const useCase = new CloseAccountUseCase(
      env.accountRepo,
      env.eventPublisher,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const result = await useCase.execute({ accountId: ACCOUNT_ID });

    expect(result.success).toBe(false);

    // Verify entities are in their original state
    const account = await env.accountRepo.findById(ACCOUNT_ID);
    expect(account?.status).toBe(AccountStatus.PAID);

    const session = await env.sessionRepo.findById(SESSION_ID);
    expect(session?.status).toBe(TableSessionStatus.OPEN);

    const table = await env.tableRepo.findById(TABLE_ID);
    expect(table?.status).toBe(TableStatus.OCCUPIED);

    // No events should have been published
    expect(env.eventPublisher.events).toHaveLength(0);
  });

  // 3. Rechazo de cuenta no pagada
  it('3. Rejects closing an unpaid account and makes no modifications to session or table', async () => {
    const env = setupEnvironment();
    // Replace account with unpaid account (OPEN, total 200, paid 0)
    const unpaidAccount = Account.create({
      id: ACCOUNT_ID,
      restaurantId: REST_ID,
      tableSessionId: SESSION_ID,
    }).value!.addOrderAmount(200).value!;
    await env.accountRepo.save(unpaidAccount);

    const useCase = new CloseAccountUseCase(
      env.accountRepo,
      env.eventPublisher,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const result = await useCase.execute({ accountId: ACCOUNT_ID });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Cannot close account');

    // State intact
    const session = await env.sessionRepo.findById(SESSION_ID);
    expect(session?.status).toBe(TableSessionStatus.OPEN);

    const table = await env.tableRepo.findById(TABLE_ID);
    expect(table?.status).toBe(TableStatus.OCCUPIED);

    expect(env.eventPublisher.events).toHaveLength(0);
  });

  // 4. Retry idempotente sin eventos duplicados
  it('4. Handles retry idempotently after confirmed close without duplicate events or errors', async () => {
    const env = setupEnvironment();
    const useCase = new CloseAccountUseCase(
      env.accountRepo,
      env.eventPublisher,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    // First close
    const firstRes = await useCase.execute({ accountId: ACCOUNT_ID });
    expect(firstRes.success).toBe(true);
    expect(env.eventPublisher.events).toHaveLength(3);

    // Clear event history to inspect retry
    env.eventPublisher.events = [];

    // Second close (Network retry)
    const retryRes = await useCase.execute({ accountId: ACCOUNT_ID });
    expect(retryRes.success).toBe(true);
    expect(retryRes.value?.status).toBe(AccountStatus.CLOSED);

    // No duplicate events on retry
    expect(env.eventPublisher.events).toHaveLength(0);
  });

  // 5. Estado inconsistente Account.CLOSED + sesión/mesa abiertas
  it('5. Detects inconsistent state (Account CLOSED with session OPEN) and fails explicitly without silent repair', async () => {
    const env = setupEnvironment();
    // Simulate corrupt state: Account is CLOSED, but Session was left OPEN
    const corruptAccount = Account.create({
      id: ACCOUNT_ID,
      restaurantId: REST_ID,
      tableSessionId: SESSION_ID,
    }).value!
      .addOrderAmount(100).value!
      .requestPayment().value!
      .registerPayment({ id: 'p1', amount: 100, method: 'cash', registeredAt: new Date() }).value!
      .close().value!;
    await env.accountRepo.save(corruptAccount);

    const useCase = new CloseAccountUseCase(
      env.accountRepo,
      env.eventPublisher,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const result = await useCase.execute({ accountId: ACCOUNT_ID });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Inconsistent state detected');

    // TableSession remains OPEN (not silently altered)
    const session = await env.sessionRepo.findById(SESSION_ID);
    expect(session?.status).toBe(TableSessionStatus.OPEN);

    expect(env.eventPublisher.events).toHaveLength(0);
  });

  // 6. Mesa ya AVAILABLE
  it('6. Successfully closes account when table was already AVAILABLE without release error', async () => {
    const env = setupEnvironment();
    // Table is already AVAILABLE
    const table = Table.create({
      id: TABLE_ID,
      restaurantId: REST_ID,
      number: 12,
      capacity: 4,
    }).value!;
    await env.tableRepo.save(table);

    const useCase = new CloseAccountUseCase(
      env.accountRepo,
      env.eventPublisher,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const result = await useCase.execute({ accountId: ACCOUNT_ID });
    expect(result.success).toBe(true);
    expect(result.value?.status).toBe(AccountStatus.CLOSED);
  });

  // 7. Sesión ya CLOSING
  it('7. Successfully closes session when it is already in CLOSING status', async () => {
    const env = setupEnvironment();
    const closingSession = (await env.sessionRepo.findById(SESSION_ID))!.requestClose().value!;
    await env.sessionRepo.save(closingSession);

    const useCase = new CloseAccountUseCase(
      env.accountRepo,
      env.eventPublisher,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const result = await useCase.execute({ accountId: ACCOUNT_ID });
    expect(result.success).toBe(true);

    const finalSession = await env.sessionRepo.findById(SESSION_ID);
    expect(finalSession?.status).toBe(TableSessionStatus.CLOSED);
  });

  // 8. Eventos post-commit con metadatos completos
  it('8. Emits canonical DomainEvents strictly post-commit with complete table metadata', async () => {
    const env = setupEnvironment();
    const useCase = new CloseAccountUseCase(
      env.accountRepo,
      env.eventPublisher,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    await useCase.execute({
      accountId: ACCOUNT_ID,
      actorType: ActorType.STAFF,
      actorId: 'cashier-042',
    });

    expect(env.eventPublisher.events).toHaveLength(3);

    // Event 1: ACCOUNT_CLOSED
    const accountClosedEvent = env.eventPublisher.events[0];
    expect(accountClosedEvent.eventType).toBe(EventType.ACCOUNT_CLOSED);
    expect(accountClosedEvent.restaurantId).toBe(REST_ID);
    expect(accountClosedEvent.payload.accountId).toBe(ACCOUNT_ID);
    expect(accountClosedEvent.payload.tableSessionId).toBe(SESSION_ID);
    expect(accountClosedEvent.payload.tableId).toBe(TABLE_ID);
    expect(accountClosedEvent.payload.tableNumber).toBe(12);
    expect(accountClosedEvent.payload.totalAmount).toBe(150);
    expect(accountClosedEvent.payload.paidAmount).toBe(150);
    expect(accountClosedEvent.actorType).toBe(ActorType.STAFF);
    expect(accountClosedEvent.actorId).toBe('cashier-042');

    // Event 2: TABLE_CLOSED
    const tableClosedEvent = env.eventPublisher.events[1];
    expect(tableClosedEvent.eventType).toBe(EventType.TABLE_CLOSED);
    expect(tableClosedEvent.restaurantId).toBe(REST_ID);
    expect(tableClosedEvent.payload.tableSessionId).toBe(SESSION_ID);
    expect(tableClosedEvent.payload.tableId).toBe(TABLE_ID);
    expect(tableClosedEvent.payload.tableNumber).toBe(12);

    // Event 3: TABLE_RELEASED
    const tableReleasedEvent = env.eventPublisher.events[2];
    expect(tableReleasedEvent.eventType).toBe(EventType.TABLE_RELEASED);
    expect(tableReleasedEvent.restaurantId).toBe(REST_ID);
    expect(tableReleasedEvent.payload.tableId).toBe(TABLE_ID);
    expect(tableReleasedEvent.payload.tableNumber).toBe(12);
  });

  // 9. Preservación de CloseTableSessionUseCase para mesas vacías/canceladas
  it('9. CloseTableSessionUseCase continues to function independently for empty/no-account sessions', async () => {
    const env = setupEnvironment();
    const emptySessionUseCase = new CloseTableSessionUseCase(
      env.tableRepo,
      env.sessionRepo,
      env.eventPublisher,
    );

    // New empty session on table 12 without account
    const emptySession = TableSession.create({
      id: 'session-empty-999',
      restaurantId: REST_ID,
      tableId: TABLE_ID,
    }).value!.occupy().value!.open().value!;
    await env.sessionRepo.save(emptySession);

    const result = await emptySessionUseCase.execute({ sessionId: 'session-empty-999' });

    expect(result.success).toBe(true);
    expect(result.value?.status).toBe(TableSessionStatus.CLOSED);

    const table = await env.tableRepo.findById(TABLE_ID);
    expect(table?.status).toBe(TableStatus.AVAILABLE);

    const events = env.eventPublisher.events.filter(
      (e) => e.payload?.sessionId === 'session-empty-999' || e.payload?.tableSessionId === 'session-empty-999',
    );
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});
