import { describe, it, expect } from 'vitest';
import {
  ChangeSessionTableUseCase,
  AddCustomerToSessionUseCase,
  RemoveCustomerFromSessionUseCase,
  CreateCustomerUseCase,
  GetCustomerUseCase,
  UpdateCustomerProfileUseCase,
  type TableRepository,
  type TableSessionRepository,
  type CustomerRepository,
  type EventPublisher,
  type TransactionRunner,
  type TransactionContext,
} from '../src';
import { Table, TableSession, TableStatus, Customer, type DomainEvent } from '@restaurant-os/domain';

class InMemoryTableRepo implements TableRepository {
  public tables = new Map<string, Table>();
  async findById(id: string) { return this.tables.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.tables.values()).filter((t) => t.restaurantId === restaurantId);
  }
  async save(table: Table) { this.tables.set(table.id, table); }
  async delete(id: string) { this.tables.delete(id); }
}

class InMemorySessionRepo implements TableSessionRepository {
  public sessions = new Map<string, TableSession>();
  async findById(id: string) { return this.sessions.get(id) ?? null; }
  async findActiveByTableId(tableId: string) {
    return Array.from(this.sessions.values()).find((s) => s.tableId === tableId && s.status !== 'CLOSED') ?? null;
  }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.sessions.values()).filter((s) => s.restaurantId === restaurantId);
  }
  async save(session: TableSession) { this.sessions.set(session.id, session); }
}

class InMemoryCustomerRepo implements CustomerRepository {
  public customers = new Map<string, Customer>();
  async findById(id: string) { return this.customers.get(id) ?? null; }
  async findByEmail(email: string) {
    return Array.from(this.customers.values()).find((c) => c.email === email) ?? null;
  }
  async findByPhone(phone: string) {
    return Array.from(this.customers.values()).find((c) => c.phone === phone) ?? null;
  }
  async save(customer: Customer) { this.customers.set(customer.id, customer); }
  async delete(id: string) { this.customers.delete(id); }
}

class RecordingEventPublisher implements EventPublisher {
  public events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  async publish(eventOrType: any, legacyPayload?: Record<string, unknown>) {
    if (typeof eventOrType === 'object' && eventOrType !== null && 'type' in eventOrType) {
      this.events.push({
        eventType: eventOrType.type,
        payload: {
          ...(eventOrType.payload ?? {}),
          tableSessionId: eventOrType.tableSessionId,
          tableId: eventOrType.tableId,
          tableNumber: eventOrType.tableNumber,
          restaurantId: eventOrType.restaurantId,
          actorType: eventOrType.actorType,
        },
      });
    } else {
      this.events.push({ eventType: eventOrType, payload: legacyPayload ?? {} });
    }
  }
}

class MockTransactionRunner implements TransactionRunner {
  constructor(private readonly mockContext: TransactionContext) {}

  async run<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return fn(this.mockContext);
  }
}

describe('TableSession and Customer Use Cases', () => {
  const REST_ID = 'rest-1';

  it('changes table session table and emits TABLE_CHANGED event', async () => {
    const tableRepo = new InMemoryTableRepo();
    const sessionRepo = new InMemorySessionRepo();
    const eventPublisher = new RecordingEventPublisher();

    const table1 = Table.create({ id: 'table-1', restaurantId: REST_ID, number: 1, capacity: 4 }).value!;
    const table2 = Table.create({ id: 'table-2', restaurantId: REST_ID, number: 2, capacity: 4 }).value!;
    await tableRepo.save(table1);
    await tableRepo.save(table2);

    const session = TableSession.create({
      id: 'session-1',
      restaurantId: REST_ID,
      tableId: 'table-1',
      initialWaiterId: 'waiter-1',
    }).value!;
    await sessionRepo.save(session);

    const useCase = new ChangeSessionTableUseCase(sessionRepo, tableRepo, eventPublisher);
    const updated = await useCase.execute({
      sessionId: 'session-1',
      newTableId: 'table-2',
    });

    expect(updated.tableId).toBe('table-2');
    expect(updated.tableHistory).toHaveLength(2);

    // Old table should be released to AVAILABLE
    const reloadedOldTable = await tableRepo.findById('table-1');
    expect(reloadedOldTable?.status).toBe(TableStatus.AVAILABLE);

    // New table should be OCCUPIED
    const reloadedNewTable = await tableRepo.findById('table-2');
    expect(reloadedNewTable?.status).toBe(TableStatus.OCCUPIED);

    // Event should be published with canonical metadata
    expect(eventPublisher.events).toHaveLength(1);
    expect(eventPublisher.events[0].eventType).toBe('TABLE_CHANGED');
    expect(eventPublisher.events[0].payload.oldTableId).toBe('table-1');
    expect(eventPublisher.events[0].payload.newTableId).toBe('table-2');
    expect(eventPublisher.events[0].payload.newTableNumber).toBe(2);
    expect(eventPublisher.events[0].payload.restaurantId).toBe(REST_ID);
  });

  it('executes changeTable atomically with TransactionRunner', async () => {
    const tableRepo = new InMemoryTableRepo();
    const sessionRepo = new InMemorySessionRepo();
    const eventPublisher = new RecordingEventPublisher();

    const txRunner = new MockTransactionRunner({
      tableRepo,
      sessionRepo,
      orderRepo: {} as any,
      kitchenOrderRepo: {} as any,
      accountRepo: {} as any,
    });

    const tableA = Table.create({ id: 'table-z', restaurantId: REST_ID, number: 12, capacity: 4 }).value!;
    const tableB = Table.create({ id: 'table-a', restaurantId: REST_ID, number: 27, capacity: 6 }).value!;
    await tableRepo.save(tableA);
    await tableRepo.save(tableB);

    const session = TableSession.create({
      id: 'session-xyz',
      restaurantId: REST_ID,
      tableId: 'table-z',
      initialWaiterId: 'waiter-9',
    }).value!;
    await sessionRepo.save(session);

    const useCase = new ChangeSessionTableUseCase(sessionRepo, tableRepo, eventPublisher, txRunner);
    const updated = await useCase.execute({
      sessionId: 'session-xyz',
      newTableId: 'table-a',
    });

    expect(updated.tableId).toBe('table-a');
    expect((await tableRepo.findById('table-z'))?.status).toBe(TableStatus.AVAILABLE);
    expect((await tableRepo.findById('table-a'))?.status).toBe(TableStatus.OCCUPIED);
    expect(eventPublisher.events).toHaveLength(1);
    expect(eventPublisher.events[0].payload.newTableNumber).toBe(27);
  });

  it('does not publish event or change tables if target table is not available', async () => {
    const tableRepo = new InMemoryTableRepo();
    const sessionRepo = new InMemorySessionRepo();
    const eventPublisher = new RecordingEventPublisher();

    const table1 = Table.create({ id: 'table-1', restaurantId: REST_ID, number: 1, capacity: 4 }).value!;
    const table2 = Table.create({ id: 'table-2', restaurantId: REST_ID, number: 2, capacity: 4, status: TableStatus.OCCUPIED }).value!;
    await tableRepo.save(table1);
    await tableRepo.save(table2);

    const session = TableSession.create({
      id: 'session-1',
      restaurantId: REST_ID,
      tableId: 'table-1',
      initialWaiterId: 'waiter-1',
    }).value!;
    await sessionRepo.save(session);

    const useCase = new ChangeSessionTableUseCase(sessionRepo, tableRepo, eventPublisher);

    await expect(useCase.execute({
      sessionId: 'session-1',
      newTableId: 'table-2',
    })).rejects.toThrow('Target table is not available');

    // No events should be published
    expect(eventPublisher.events).toHaveLength(0);
    // Old table remains unchanged
    expect((await tableRepo.findById('table-1'))?.status).toBe(TableStatus.AVAILABLE);
  });

  it('adds and removes customer from table session', async () => {
    const sessionRepo = new InMemorySessionRepo();
    const eventPublisher = new RecordingEventPublisher();

    const session = TableSession.create({
      id: 'session-1',
      restaurantId: REST_ID,
      tableId: 'table-1',
      initialWaiterId: 'waiter-1',
    }).value!;
    await sessionRepo.save(session);

    const addUseCase = new AddCustomerToSessionUseCase(sessionRepo, eventPublisher);
    const withCust = await addUseCase.execute({
      sessionId: 'session-1',
      customerId: 'cust-100',
    });

    expect(withCust.customerIds).toEqual(['cust-100']);
    expect(eventPublisher.events[0].eventType).toBe('CUSTOMER_ADDED_TO_TABLE');

    const removeUseCase = new RemoveCustomerFromSessionUseCase(sessionRepo, eventPublisher);
    const withoutCust = await removeUseCase.execute({
      sessionId: 'session-1',
      customerId: 'cust-100',
    });

    expect(withoutCust.customerIds).toEqual([]);
    expect(eventPublisher.events[1].eventType).toBe('CUSTOMER_REMOVED_FROM_TABLE');
  });

  it('creates, gets, and updates customer profile', async () => {
    const customerRepo = new InMemoryCustomerRepo();

    const createUseCase = new CreateCustomerUseCase(customerRepo);
    const customer = await createUseCase.execute({
      id: 'cust-1',
      name: 'Alice',
      email: 'alice@example.com',
      phone: '123456',
    });

    expect(customer.id).toBe('cust-1');
    expect(customer.name).toBe('Alice');

    const getUseCase = new GetCustomerUseCase(customerRepo);
    const fetched = await getUseCase.execute('cust-1');
    expect(fetched?.email).toBe('alice@example.com');

    const updateUseCase = new UpdateCustomerProfileUseCase(customerRepo);
    const updated = await updateUseCase.execute({
      id: 'cust-1',
      name: 'Alice Smith',
    });

    expect(updated.name).toBe('Alice Smith');
    expect(updated.email).toBe('alice@example.com');
  });
});
