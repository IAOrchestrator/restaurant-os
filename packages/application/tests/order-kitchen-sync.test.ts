import { describe, it, expect } from 'vitest';
import {
  SendToKitchenUseCase,
  StartKitchenOrderUseCase,
  MarkKitchenOrderReadyUseCase,
  DeliverOrderUseCase,
  type OrderRepository,
  type KitchenOrderRepository,
  type TableSessionRepository,
  type TableRepository,
  type AccountRepository,
  type EventPublisher,
  type TransactionRunner,
  type TransactionContext,
} from '../src';
import {
  Order,
  OrderStatus,
  KitchenOrder,
  KitchenOrderStatus,
  Table,
  TableSession,
  Account,
  EventType,
  ActorType,
  type DomainEvent,
} from '@restaurant-os/domain';

class InMemoryOrderRepo implements OrderRepository {
  public orders = new Map<string, Order>();
  async findById(id: string) { return this.orders.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.orders.values()).filter((o) => o.restaurantId === restaurantId);
  }
  async findByTableSessionId(sessionId: string) {
    return Array.from(this.orders.values()).filter((o) => o.tableSessionId === sessionId);
  }
  async save(order: Order) { this.orders.set(order.id, order); }
  async delete(id: string) { this.orders.delete(id); }
}

class InMemoryKitchenOrderRepo implements KitchenOrderRepository {
  public kitchenOrders = new Map<string, KitchenOrder>();
  async findById(id: string) { return this.kitchenOrders.get(id) ?? null; }
  async findByOrderId(orderId: string) {
    return Array.from(this.kitchenOrders.values()).find((k) => k.orderId === orderId) ?? null;
  }
  async findByRestaurantId(restaurantId: string, status?: string) {
    return Array.from(this.kitchenOrders.values()).filter(
      (k) => k.restaurantId === restaurantId && (!status || k.status === status),
    );
  }
  async findByAssignedTo(staffId: string) {
    return Array.from(this.kitchenOrders.values()).filter((k) => k.assignedTo === staffId);
  }
  async save(ko: KitchenOrder) { this.kitchenOrders.set(ko.id, ko); }
  async delete(id: string) { this.kitchenOrders.delete(id); }
}

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

class InMemoryAccountRepo implements AccountRepository {
  public accounts = new Map<string, Account>();
  async findById(id: string) { return this.accounts.get(id) ?? null; }
  async findByTableSessionId(sessionId: string) {
    return Array.from(this.accounts.values()).filter((a) => a.tableSessionId === sessionId);
  }
  async findActiveByTableSessionId(sessionId: string) {
    return Array.from(this.accounts.values()).find((a) => a.tableSessionId === sessionId && a.status === 'OPEN') ?? null;
  }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.accounts.values()).filter((a) => a.restaurantId === restaurantId);
  }
  async save(account: Account) { this.accounts.set(account.id, account); }
  async delete(id: string) { this.accounts.delete(id); }
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
          actorId: eventOrType.actorId,
        },
      });
    } else {
      this.events.push({ eventType: eventOrType, payload: legacyPayload ?? {} });
    }
  }
}

class SnapshottingTransactionRunner implements TransactionRunner {
  constructor(
    private readonly tableRepo: InMemoryTableRepo,
    private readonly sessionRepo: InMemorySessionRepo,
    private readonly orderRepo: InMemoryOrderRepo,
    private readonly kitchenOrderRepo: InMemoryKitchenOrderRepo,
    private readonly accountRepo: InMemoryAccountRepo,
  ) {}

  async run<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    // Snapshot state before executing transaction
    const tableSnap = new Map(this.tableRepo.tables);
    const sessionSnap = new Map(this.sessionRepo.sessions);
    const orderSnap = new Map(this.orderRepo.orders);
    const kitchenSnap = new Map(this.kitchenOrderRepo.kitchenOrders);
    const accountSnap = new Map(this.accountRepo.accounts);

    try {
      return await fn({
        tableRepo: this.tableRepo,
        sessionRepo: this.sessionRepo,
        orderRepo: this.orderRepo,
        kitchenOrderRepo: this.kitchenOrderRepo,
        accountRepo: this.accountRepo,
      });
    } catch (err) {
      // Rollback
      this.tableRepo.tables = tableSnap;
      this.sessionRepo.sessions = sessionSnap;
      this.orderRepo.orders = orderSnap;
      this.kitchenOrderRepo.kitchenOrders = kitchenSnap;
      this.accountRepo.accounts = accountSnap;
      throw err;
    }
  }
}

describe('Order <-> KitchenOrder Transactional Synchronization (Step 1.3)', () => {
  const REST_ID = 'rest-001';
  const TABLE_ID = 'table-001';
  const SESSION_ID = 'session-001';

  function setupEnvironment() {
    const tableRepo = new InMemoryTableRepo();
    const sessionRepo = new InMemorySessionRepo();
    const orderRepo = new InMemoryOrderRepo();
    const kitchenOrderRepo = new InMemoryKitchenOrderRepo();
    const accountRepo = new InMemoryAccountRepo();
    const eventPublisher = new RecordingEventPublisher();
    const txRunner = new SnapshottingTransactionRunner(
      tableRepo,
      sessionRepo,
      orderRepo,
      kitchenOrderRepo,
      accountRepo,
    );

    const table = Table.create({ id: TABLE_ID, restaurantId: REST_ID, number: 7, capacity: 4 }).value!;
    tableRepo.save(table);

    const session = TableSession.create({
      id: SESSION_ID,
      restaurantId: REST_ID,
      tableId: TABLE_ID,
      initialWaiterId: 'waiter-001',
    }).value!;
    sessionRepo.save(session);

    return {
      tableRepo,
      sessionRepo,
      orderRepo,
      kitchenOrderRepo,
      accountRepo,
      eventPublisher,
      txRunner,
    };
  }

  // A. SendToKitchen crea exactamente un KitchenOrder
  it('A. SendToKitchen creates exactly one KitchenOrder with RECEIVED status', async () => {
    const env = setupEnvironment();
    const useCase = new SendToKitchenUseCase(
      env.orderRepo,
      env.eventPublisher,
      env.kitchenOrderRepo,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const order = Order.create({
      id: 'order-1',
      restaurantId: REST_ID,
      tableSessionId: SESSION_ID,
    }).value!;
    const withItem = order.addItem({ productId: 'prod-1', productName: 'Burger', quantity: 2, unitPrice: 10 }).value!;
    const confirmed = withItem.confirm().value!;
    await env.orderRepo.save(confirmed);

    const result = await useCase.execute({ orderId: 'order-1' });
    expect(result.success).toBe(true);
    expect(result.value?.status).toBe(OrderStatus.SENT_TO_KITCHEN);

    // Verify KitchenOrder exists
    const kitchenOrders = await env.kitchenOrderRepo.findByRestaurantId(REST_ID);
    expect(kitchenOrders).toHaveLength(1);
    expect(kitchenOrders[0].orderId).toBe('order-1');
    expect(kitchenOrders[0].status).toBe(KitchenOrderStatus.RECEIVED);
  });

  // B. Retry de SendToKitchen no crea duplicados (Idempotencia)
  it('B. Retry of SendToKitchen is idempotent and does not create duplicate KitchenOrders or events', async () => {
    const env = setupEnvironment();
    const useCase = new SendToKitchenUseCase(
      env.orderRepo,
      env.eventPublisher,
      env.kitchenOrderRepo,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const order = Order.create({
      id: 'order-1',
      restaurantId: REST_ID,
      tableSessionId: SESSION_ID,
    }).value!;
    const withItem = order.addItem({ productId: 'prod-1', productName: 'Burger', quantity: 1, unitPrice: 10 }).value!;
    const confirmed = withItem.confirm().value!;
    await env.orderRepo.save(confirmed);

    // First attempt
    const res1 = await useCase.execute({ orderId: 'order-1' });
    expect(res1.success).toBe(true);
    expect(env.eventPublisher.events).toHaveLength(1);
    expect(env.eventPublisher.events[0].eventType).toBe(EventType.ORDER_SENT_TO_KITCHEN);

    // Second attempt (Retry after network timeout)
    const res2 = await useCase.execute({ orderId: 'order-1' });
    expect(res2.success).toBe(true);
    expect(res2.value?.id).toBe('order-1');
    expect(res2.value?.status).toBe(OrderStatus.SENT_TO_KITCHEN);

    // Verify still exactly 1 KitchenOrder and no duplicate event
    const kitchenOrders = await env.kitchenOrderRepo.findByRestaurantId(REST_ID);
    expect(kitchenOrders).toHaveLength(1);
    expect(env.eventPublisher.events).toHaveLength(1);
  });

  // C. Rollback de SendToKitchen deja Order y KitchenOrder sin cambios parciales
  it('C. Rollback of SendToKitchen restores Order and leaves no orphan KitchenOrder', async () => {
    const env = setupEnvironment();

    // Custom TransactionRunner that simulates a DB failure right before commit
    const failingTxRunner: TransactionRunner = {
      run: async (fn) => {
        const orderSnap = new Map(env.orderRepo.orders);
        const kitchenSnap = new Map(env.kitchenOrderRepo.kitchenOrders);
        try {
          await fn({
            tableRepo: env.tableRepo,
            sessionRepo: env.sessionRepo,
            orderRepo: env.orderRepo,
            kitchenOrderRepo: env.kitchenOrderRepo,
            accountRepo: env.accountRepo,
          });
          throw new Error('Database transaction abort / constraint violation');
        } catch (err) {
          env.orderRepo.orders = orderSnap;
          env.kitchenOrderRepo.kitchenOrders = kitchenSnap;
          throw err;
        }
      },
    };

    const useCase = new SendToKitchenUseCase(
      env.orderRepo,
      env.eventPublisher,
      env.kitchenOrderRepo,
      env.sessionRepo,
      env.tableRepo,
      failingTxRunner,
    );

    const order = Order.create({
      id: 'order-1',
      restaurantId: REST_ID,
      tableSessionId: SESSION_ID,
    }).value!;
    const withItem = order.addItem({ productId: 'prod-1', productName: 'Burger', quantity: 1, unitPrice: 10 }).value!;
    const confirmed = withItem.confirm().value!;
    await env.orderRepo.save(confirmed);

    await expect(useCase.execute({ orderId: 'order-1' })).rejects.toThrow('Database transaction abort');

    // Verify Order is still CONFIRMED (not SENT_TO_KITCHEN) and no KitchenOrder exists
    const orderAfter = await env.orderRepo.findById('order-1');
    expect(orderAfter?.status).toBe(OrderStatus.CONFIRMED);
    const kitchenOrders = await env.kitchenOrderRepo.findByRestaurantId(REST_ID);
    expect(kitchenOrders).toHaveLength(0);
    // No events published
    expect(env.eventPublisher.events).toHaveLength(0);
  });

  // D. STARTED sincroniza Order -> PREPARING
  it('D. StartKitchenOrder transitions KitchenOrder to STARTED and Order to PREPARING', async () => {
    const env = setupEnvironment();
    const sendUseCase = new SendToKitchenUseCase(
      env.orderRepo,
      env.eventPublisher,
      env.kitchenOrderRepo,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );
    const startUseCase = new StartKitchenOrderUseCase(
      env.kitchenOrderRepo,
      env.eventPublisher,
      env.orderRepo,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const order = Order.create({ id: 'order-1', restaurantId: REST_ID, tableSessionId: SESSION_ID }).value!;
    const confirmed = order.addItem({ productId: 'p1', productName: 'Pasta', quantity: 1, unitPrice: 15 }).value!.confirm().value!;
    await env.orderRepo.save(confirmed);
    await sendUseCase.execute({ orderId: 'order-1' });

    const kitchenOrder = (await env.kitchenOrderRepo.findByOrderId('order-1'))!;
    expect(kitchenOrder.status).toBe(KitchenOrderStatus.RECEIVED);

    const startRes = await startUseCase.execute({ kitchenOrderId: kitchenOrder.id });
    expect(startRes.success).toBe(true);
    expect(startRes.value?.status).toBe(KitchenOrderStatus.STARTED);

    // Verify Order is now PREPARING
    const updatedOrder = (await env.orderRepo.findById('order-1'))!;
    expect(updatedOrder.status).toBe(OrderStatus.PREPARING);
  });

  // E. Rollback de STARTED no deja estados divergentes
  it('E. Rollback of StartKitchenOrder rolls back both KitchenOrder and Order', async () => {
    const env = setupEnvironment();
    const sendUseCase = new SendToKitchenUseCase(
      env.orderRepo,
      env.eventPublisher,
      env.kitchenOrderRepo,
      env.sessionRepo,
      env.tableRepo,
      env.txRunner,
    );

    const order = Order.create({ id: 'order-1', restaurantId: REST_ID, tableSessionId: SESSION_ID }).value!;
    const confirmed = order.addItem({ productId: 'p1', productName: 'Pasta', quantity: 1, unitPrice: 15 }).value!.confirm().value!;
    await env.orderRepo.save(confirmed);
    await sendUseCase.execute({ orderId: 'order-1' });
    env.eventPublisher.events = [];

    const kitchenOrder = (await env.kitchenOrderRepo.findByOrderId('order-1'))!;

    const failingTxRunner: TransactionRunner = {
      run: async (fn) => {
        const orderSnap = new Map(env.orderRepo.orders);
        const kitchenSnap = new Map(env.kitchenOrderRepo.kitchenOrders);
        try {
          await fn({
            tableRepo: env.tableRepo,
            sessionRepo: env.sessionRepo,
            orderRepo: env.orderRepo,
            kitchenOrderRepo: env.kitchenOrderRepo,
            accountRepo: env.accountRepo,
          });
          throw new Error('Transaction failed during kitchen start');
        } catch (err) {
          env.orderRepo.orders = orderSnap;
          env.kitchenOrderRepo.kitchenOrders = kitchenSnap;
          throw err;
        }
      },
    };

    const startUseCase = new StartKitchenOrderUseCase(
      env.kitchenOrderRepo,
      env.eventPublisher,
      env.orderRepo,
      env.sessionRepo,
      env.tableRepo,
      failingTxRunner,
    );

    await expect(startUseCase.execute({ kitchenOrderId: kitchenOrder.id })).rejects.toThrow('Transaction failed during kitchen start');

    // Both entities must remain unchanged
    const koAfter = (await env.kitchenOrderRepo.findById(kitchenOrder.id))!;
    expect(koAfter.status).toBe(KitchenOrderStatus.RECEIVED);
    const orderAfter = (await env.orderRepo.findById('order-1'))!;
    expect(orderAfter.status).toBe(OrderStatus.SENT_TO_KITCHEN);
    expect(env.eventPublisher.events).toHaveLength(0);
  });

  // F. READY sincroniza KitchenOrder -> Order
  it('F. MarkKitchenOrderReady transitions KitchenOrder to READY and Order to READY', async () => {
    const env = setupEnvironment();
    const sendUseCase = new SendToKitchenUseCase(env.orderRepo, env.eventPublisher, env.kitchenOrderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const startUseCase = new StartKitchenOrderUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const readyUseCase = new MarkKitchenOrderReadyUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, env.txRunner);

    const order = Order.create({ id: 'order-1', restaurantId: REST_ID, tableSessionId: SESSION_ID }).value!;
    const confirmed = order.addItem({ productId: 'p1', productName: 'Steak', quantity: 1, unitPrice: 25 }).value!.confirm().value!;
    await env.orderRepo.save(confirmed);
    await sendUseCase.execute({ orderId: 'order-1' });

    const kitchenOrder = (await env.kitchenOrderRepo.findByOrderId('order-1'))!;
    await startUseCase.execute({ kitchenOrderId: kitchenOrder.id });

    const readyRes = await readyUseCase.execute({ kitchenOrderId: kitchenOrder.id });
    expect(readyRes.success).toBe(true);
    expect(readyRes.value?.status).toBe(KitchenOrderStatus.READY);

    // Verify Order is now READY
    const orderAfter = (await env.orderRepo.findById('order-1'))!;
    expect(orderAfter.status).toBe(OrderStatus.READY);
  });

  // G. Rollback de READY no deja estados divergentes
  it('G. Rollback of MarkKitchenOrderReady leaves both KitchenOrder and Order in PREPARING / STARTED', async () => {
    const env = setupEnvironment();
    const sendUseCase = new SendToKitchenUseCase(env.orderRepo, env.eventPublisher, env.kitchenOrderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const startUseCase = new StartKitchenOrderUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, env.txRunner);

    const order = Order.create({ id: 'order-1', restaurantId: REST_ID, tableSessionId: SESSION_ID }).value!;
    const confirmed = order.addItem({ productId: 'p1', productName: 'Steak', quantity: 1, unitPrice: 25 }).value!.confirm().value!;
    await env.orderRepo.save(confirmed);
    await sendUseCase.execute({ orderId: 'order-1' });
    const kitchenOrder = (await env.kitchenOrderRepo.findByOrderId('order-1'))!;
    await startUseCase.execute({ kitchenOrderId: kitchenOrder.id });
    env.eventPublisher.events = [];

    const failingTxRunner: TransactionRunner = {
      run: async (fn) => {
        const orderSnap = new Map(env.orderRepo.orders);
        const kitchenSnap = new Map(env.kitchenOrderRepo.kitchenOrders);
        try {
          await fn({
            tableRepo: env.tableRepo,
            sessionRepo: env.sessionRepo,
            orderRepo: env.orderRepo,
            kitchenOrderRepo: env.kitchenOrderRepo,
            accountRepo: env.accountRepo,
          });
          throw new Error('Transaction aborted during ready mark');
        } catch (err) {
          env.orderRepo.orders = orderSnap;
          env.kitchenOrderRepo.kitchenOrders = kitchenSnap;
          throw err;
        }
      },
    };

    const readyUseCase = new MarkKitchenOrderReadyUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, failingTxRunner);

    await expect(readyUseCase.execute({ kitchenOrderId: kitchenOrder.id })).rejects.toThrow('Transaction aborted during ready mark');

    const koAfter = (await env.kitchenOrderRepo.findById(kitchenOrder.id))!;
    expect(koAfter.status).toBe(KitchenOrderStatus.STARTED);
    const orderAfter = (await env.orderRepo.findById('order-1'))!;
    expect(orderAfter.status).toBe(OrderStatus.PREPARING);
    expect(env.eventPublisher.events).toHaveLength(0);
  });

  // H. DELIVERED sincroniza Order -> KitchenOrder.COMPLETED
  it('H. DeliverOrder transitions Order to DELIVERED and KitchenOrder to COMPLETED', async () => {
    const env = setupEnvironment();
    const sendUseCase = new SendToKitchenUseCase(env.orderRepo, env.eventPublisher, env.kitchenOrderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const startUseCase = new StartKitchenOrderUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const readyUseCase = new MarkKitchenOrderReadyUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const deliverUseCase = new DeliverOrderUseCase(env.orderRepo, env.eventPublisher, env.kitchenOrderRepo, env.sessionRepo, env.tableRepo, env.txRunner);

    const order = Order.create({ id: 'order-1', restaurantId: REST_ID, tableSessionId: SESSION_ID }).value!;
    const confirmed = order.addItem({ productId: 'p1', productName: 'Pizza', quantity: 1, unitPrice: 20 }).value!.confirm().value!;
    await env.orderRepo.save(confirmed);
    await sendUseCase.execute({ orderId: 'order-1' });
    const kitchenOrder = (await env.kitchenOrderRepo.findByOrderId('order-1'))!;
    await startUseCase.execute({ kitchenOrderId: kitchenOrder.id });
    await readyUseCase.execute({ kitchenOrderId: kitchenOrder.id });

    const deliverRes = await deliverUseCase.execute({ orderId: 'order-1' });
    expect(deliverRes.success).toBe(true);
    expect(deliverRes.value?.status).toBe(OrderStatus.DELIVERED);

    // Verify KitchenOrder is now COMPLETED
    const koAfter = (await env.kitchenOrderRepo.findById(kitchenOrder.id))!;
    expect(koAfter.status).toBe(KitchenOrderStatus.COMPLETED);
  });

  // I. Rollback de DELIVERED no deja estados divergentes
  it('I. Rollback of DeliverOrder restores Order to READY and KitchenOrder to READY', async () => {
    const env = setupEnvironment();
    const sendUseCase = new SendToKitchenUseCase(env.orderRepo, env.eventPublisher, env.kitchenOrderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const startUseCase = new StartKitchenOrderUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const readyUseCase = new MarkKitchenOrderReadyUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, env.txRunner);

    const order = Order.create({ id: 'order-1', restaurantId: REST_ID, tableSessionId: SESSION_ID }).value!;
    const confirmed = order.addItem({ productId: 'p1', productName: 'Pizza', quantity: 1, unitPrice: 20 }).value!.confirm().value!;
    await env.orderRepo.save(confirmed);
    await sendUseCase.execute({ orderId: 'order-1' });
    const kitchenOrder = (await env.kitchenOrderRepo.findByOrderId('order-1'))!;
    await startUseCase.execute({ kitchenOrderId: kitchenOrder.id });
    await readyUseCase.execute({ kitchenOrderId: kitchenOrder.id });
    env.eventPublisher.events = [];

    const failingTxRunner: TransactionRunner = {
      run: async (fn) => {
        const orderSnap = new Map(env.orderRepo.orders);
        const kitchenSnap = new Map(env.kitchenOrderRepo.kitchenOrders);
        try {
          await fn({
            tableRepo: env.tableRepo,
            sessionRepo: env.sessionRepo,
            orderRepo: env.orderRepo,
            kitchenOrderRepo: env.kitchenOrderRepo,
            accountRepo: env.accountRepo,
          });
          throw new Error('Transaction aborted on delivery');
        } catch (err) {
          env.orderRepo.orders = orderSnap;
          env.kitchenOrderRepo.kitchenOrders = kitchenSnap;
          throw err;
        }
      },
    };

    const deliverUseCase = new DeliverOrderUseCase(env.orderRepo, env.eventPublisher, env.kitchenOrderRepo, env.sessionRepo, env.tableRepo, failingTxRunner);

    await expect(deliverUseCase.execute({ orderId: 'order-1' })).rejects.toThrow('Transaction aborted on delivery');

    const orderAfter = (await env.orderRepo.findById('order-1'))!;
    expect(orderAfter.status).toBe(OrderStatus.READY);
    const koAfter = (await env.kitchenOrderRepo.findById(kitchenOrder.id))!;
    expect(koAfter.status).toBe(KitchenOrderStatus.READY);
    expect(env.eventPublisher.events).toHaveLength(0);
  });

  // J. Los eventos no se publican si la transacción falla
  it('J. Events are never published before commit or on transaction failure', async () => {
    const env = setupEnvironment();

    const failingTxRunner: TransactionRunner = {
      run: async () => {
        throw new Error('Fatal database disk error');
      },
    };

    const sendUseCase = new SendToKitchenUseCase(env.orderRepo, env.eventPublisher, env.kitchenOrderRepo, env.sessionRepo, env.tableRepo, failingTxRunner);

    const order = Order.create({ id: 'order-1', restaurantId: REST_ID, tableSessionId: SESSION_ID }).value!;
    const confirmed = order.addItem({ productId: 'p1', productName: 'Soup', quantity: 1, unitPrice: 8 }).value!.confirm().value!;
    await env.orderRepo.save(confirmed);

    await expect(sendUseCase.execute({ orderId: 'order-1' })).rejects.toThrow('Fatal database disk error');
    expect(env.eventPublisher.events).toHaveLength(0);
  });

  // K. Los eventos contienen los metadatos de contexto de mesa
  it('K. ORDER_READY and related events contain full table context metadata for waiter workspace', async () => {
    const env = setupEnvironment();
    const sendUseCase = new SendToKitchenUseCase(env.orderRepo, env.eventPublisher, env.kitchenOrderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const startUseCase = new StartKitchenOrderUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, env.txRunner);
    const readyUseCase = new MarkKitchenOrderReadyUseCase(env.kitchenOrderRepo, env.eventPublisher, env.orderRepo, env.sessionRepo, env.tableRepo, env.txRunner);

    const order = Order.create({ id: 'order-1', restaurantId: REST_ID, tableSessionId: SESSION_ID }).value!;
    const confirmed = order.addItem({ productId: 'p1', productName: 'Tacos', quantity: 3, unitPrice: 12 }).value!.confirm().value!;
    await env.orderRepo.save(confirmed);

    await sendUseCase.execute({ orderId: 'order-1', actorType: ActorType.STAFF, actorId: 'waiter-001' });
    const kitchenOrder = (await env.kitchenOrderRepo.findByOrderId('order-1'))!;
    await startUseCase.execute({ kitchenOrderId: kitchenOrder.id, actorType: ActorType.STAFF, actorId: 'cook-001' });
    env.eventPublisher.events = [];

    await readyUseCase.execute({ kitchenOrderId: kitchenOrder.id, actorType: ActorType.STAFF, actorId: 'cook-001' });

    expect(env.eventPublisher.events).toHaveLength(1);
    const readyEvent = env.eventPublisher.events[0];
    expect(readyEvent.eventType).toBe(EventType.ORDER_READY);
    expect(readyEvent.payload.restaurantId).toBe(REST_ID);
    expect(readyEvent.payload.tableSessionId).toBe(SESSION_ID);
    expect(readyEvent.payload.tableId).toBe(TABLE_ID);
    expect(readyEvent.payload.tableNumber).toBe(7);
    expect(readyEvent.payload.orderId).toBe('order-1');
    expect(readyEvent.payload.kitchenOrderId).toBe(kitchenOrder.id);
    expect(readyEvent.payload.actorType).toBe(ActorType.STAFF);
    expect(readyEvent.payload.actorId).toBe('cook-001');
  });
});
