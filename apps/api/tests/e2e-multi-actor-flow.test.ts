import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import {
  JwtService,
  EventBroadcaster,
  PersistingEventPublisher,
  setupAuth,
} from '@restaurant-os/infrastructure';
import {
  RoleBasedPermissionChecker,
  OperationalResourceScoper,
  type TableRepository,
  type TableSessionRepository,
  type OrderRepository,
  type AccountRepository,
  type KitchenOrderRepository,
  type ServiceTaskRepository,
  type EventLogRepository,
} from '@restaurant-os/application';
import {
  Table,
  TableSession,
  Order,
  Account,
  KitchenOrder,
  ServiceTask,
  EventLog,
  StaffRole,
  EventType,
} from '@restaurant-os/domain';
import { tableRoutes } from '../src/routes/tables';
import { tableSessionRoutes } from '../src/routes/table-sessions';
import { orderRoutes } from '../src/routes/orders';
import { kitchenRoutes } from '../src/routes/kitchen';
import { billingRoutes } from '../src/routes/billing';
import { serviceRoutes } from '../src/routes/service';
import { sseRoutes } from '../src/routes/sse';

// In-Memory Repositories for High-Speed E2E Testing
class MemoryTableRepo implements TableRepository {
  public map = new Map<string, Table>();
  async findById(id: string) { return this.map.get(id) ?? null; }
  async findByRestaurantId(rId: string) { return Array.from(this.map.values()).filter(t => t.restaurantId === rId); }
  async save(t: Table) { this.map.set(t.id, t); }
  async delete(id: string) { this.map.delete(id); }
}

class MemorySessionRepo implements TableSessionRepository {
  public map = new Map<string, TableSession>();
  async findById(id: string) { return this.map.get(id) ?? null; }
  async findActiveByTableId(tableId: string) {
    return Array.from(this.map.values()).find(s => s.tableId === tableId && s.status !== 'CLOSED') ?? null;
  }
  async findByRestaurantId(rId: string) { return Array.from(this.map.values()).filter(s => s.restaurantId === rId); }
  async save(s: TableSession) { this.map.set(s.id, s); }
  async delete(id: string) { this.map.delete(id); }
}

class MemoryOrderRepo implements OrderRepository {
  public map = new Map<string, Order>();
  async findById(id: string) { return this.map.get(id) ?? null; }
  async findByTableSessionId(sId: string) { return Array.from(this.map.values()).filter(o => o.tableSessionId === sId); }
  async findByRestaurantId(rId: string) { return Array.from(this.map.values()).filter(o => o.restaurantId === rId); }
  async save(o: Order) { this.map.set(o.id, o); }
  async delete(id: string) { this.map.delete(id); }
}

class MemoryAccountRepo implements AccountRepository {
  public map = new Map<string, Account>();
  async findById(id: string) { return this.map.get(id) ?? null; }
  async findByTableSessionId(sId: string) { return Array.from(this.map.values()).find(a => a.tableSessionId === sId) ?? null; }
  async save(a: Account) { this.map.set(a.id, a); }
  async delete(id: string) { this.map.delete(id); }
}

class MemoryKitchenRepo implements KitchenOrderRepository {
  public map = new Map<string, KitchenOrder>();
  async findById(id: string) { return this.map.get(id) ?? null; }
  async findByOrderId(oId: string) { return Array.from(this.map.values()).find(k => k.orderId === oId) ?? null; }
  async findByRestaurantId(rId: string) { return Array.from(this.map.values()).filter(k => k.restaurantId === rId); }
  async save(k: KitchenOrder) { this.map.set(k.id, k); }
  async delete(id: string) { this.map.delete(id); }
}

class MemoryServiceTaskRepo implements ServiceTaskRepository {
  public map = new Map<string, ServiceTask>();
  async findById(id: string) { return this.map.get(id) ?? null; }
  async findByTableSessionId(sId: string) { return Array.from(this.map.values()).filter(t => t.tableSessionId === sId); }
  async findByRestaurantId(rId: string) { return Array.from(this.map.values()).filter(t => t.restaurantId === rId); }
  async save(t: ServiceTask) { this.map.set(t.id, t); }
  async delete(id: string) { this.map.delete(id); }
}

class MemoryEventLogRepo implements EventLogRepository {
  public logs: EventLog[] = [];
  async findById(id: string) { return this.logs.find(l => l.id === id) ?? null; }
  async findByRestaurantId(rId: string) { return this.logs.filter(l => l.restaurantId === rId); }
  async findByAggregateId(aId: string) { return this.logs.filter(l => l.aggregateId === aId); }
  async findByTableSessionId(sId: string) { return this.logs.filter(l => l.tableSessionId === sId); }
  async findByEventType(eventType: string, rId: string) { return this.logs.filter(l => l.eventType === eventType && l.restaurantId === rId); }
  async save(log: EventLog) { this.logs.push(log); }
}

describe('E2E Multi-Device & Multi-Actor Lifecycle Flow', () => {
  let app: FastifyInstance;
  const jwtService = new JwtService('e2e_test_secret_key_888');
  const broadcaster = new EventBroadcaster();

  const RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';
  const TABLE_1_ID = 'b0000000-0000-0000-0000-000000000001';
  const WAITER_ID = 'e0000000-0000-0000-0000-000000000001';
  const RECEPTIONIST_ID = 'f0000000-0000-0000-0000-000000000001';
  const CHEF_ID = 'c0000000-0000-0000-0000-000000000002';
  const CASHIER_ID = 'c0000000-0000-0000-0000-000000000003';
  const CUSTOMER_ID = 'd0000000-0000-0000-0000-000000000001';

  // Repositories
  const tableRepo = new MemoryTableRepo();
  const sessionRepo = new MemorySessionRepo();
  const orderRepo = new MemoryOrderRepo();
  const accountRepo = new MemoryAccountRepo();
  const kitchenOrderRepo = new MemoryKitchenRepo();
  const serviceTaskRepo = new MemoryServiceTaskRepo();
  const eventLogRepo = new MemoryEventLogRepo();

  const eventPublisher = new PersistingEventPublisher(eventLogRepo, {
    publish: async (eventType, payload) => {
      broadcaster.broadcast(eventType, payload);
    },
  });

  beforeAll(async () => {
    app = fastify();

    const permissionChecker = new RoleBasedPermissionChecker(async (staffId: string) => {
      if (staffId === RECEPTIONIST_ID) return [StaffRole.RECEPTIONIST];
      if (staffId === WAITER_ID) return [StaffRole.WAITER];
      if (staffId === CHEF_ID) return [StaffRole.KITCHEN];
      if (staffId === CASHIER_ID) return [StaffRole.CASHIER];
      return [StaffRole.ADMIN];
    });

    const resourceScoper = new OperationalResourceScoper(
      async (waiterId: string) => {
        const sessions = await sessionRepo.findByRestaurantId(RESTAURANT_ID);
        return sessions.filter(s => s.currentWaiterId === waiterId).map(s => s.id);
      },
      async () => null,
      async (staffId: string) => {
        if (staffId === RECEPTIONIST_ID) return [StaffRole.RECEPTIONIST];
        if (staffId === WAITER_ID) return [StaffRole.WAITER];
        if (staffId === CHEF_ID) return [StaffRole.KITCHEN];
        if (staffId === CASHIER_ID) return [StaffRole.CASHIER];
        return [StaffRole.ADMIN];
      },
    );

    setupAuth(app, { permissionChecker, resourceScoper, jwtService });

    await app.register(tableRoutes, { prefix: '/api/tables', tableRepo, sessionRepo, eventPublisher });
    await app.register(tableSessionRoutes, { prefix: '/api/table-sessions', tableRepo, sessionRepo, eventPublisher });
    await app.register(orderRoutes, { prefix: '/api/orders', orderRepo, preOrderRepo: null as any, eventPublisher });
    await app.register(kitchenRoutes, { prefix: '/api/kitchen', kitchenOrderRepo, eventPublisher });
    await app.register(billingRoutes, { prefix: '/api/billing', accountRepo, orderRepo, eventPublisher });
    await app.register(serviceRoutes, { prefix: '/api/service', serviceTaskRepo, eventPublisher });
    await app.register(sseRoutes, { prefix: '/api/events', broadcaster, jwtService });

    // Seed initial table
    const tableRes = Table.create({
      id: TABLE_1_ID,
      restaurantId: RESTAURANT_ID,
      number: 1,
      capacity: 4,
    });
    if (tableRes.success) {
      await tableRepo.save(tableRes.value);
    }

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('executes full end-to-end multi-device lifecycle with synchronized events', async () => {
    // 1. Generate JWT Tokens for all actors
    const hostToken = jwtService.sign({ sub: RECEPTIONIST_ID, type: 'STAFF', restaurantId: RESTAURANT_ID, roles: [StaffRole.RECEPTIONIST] });
    const waiterToken = jwtService.sign({ sub: WAITER_ID, type: 'STAFF', restaurantId: RESTAURANT_ID, roles: [StaffRole.WAITER] });
    const chefToken = jwtService.sign({ sub: CHEF_ID, type: 'STAFF', restaurantId: RESTAURANT_ID, roles: [StaffRole.KITCHEN] });
    const cashierToken = jwtService.sign({ sub: CASHIER_ID, type: 'STAFF', restaurantId: RESTAURANT_ID, roles: [StaffRole.CASHIER] });

    // 2. Setup Multi-Device Mock SSE Event Listeners
    const hostEvents: string[] = [];
    const waiterEvents: string[] = [];
    const kitchenEvents: string[] = [];
    const cashierEvents: string[] = [];
    const customerEvents: string[] = [];

    broadcaster.addConnection({ id: 'host-dev', restaurantId: RESTAURANT_ID, tableSessionId: null, eventTypes: null, write: (d) => hostEvents.push(d), close: () => {} });
    broadcaster.addConnection({ id: 'waiter-dev', restaurantId: RESTAURANT_ID, tableSessionId: null, eventTypes: null, write: (d) => waiterEvents.push(d), close: () => {} });
    broadcaster.addConnection({ id: 'kitchen-dev', restaurantId: RESTAURANT_ID, tableSessionId: null, eventTypes: null, write: (d) => kitchenEvents.push(d), close: () => {} });
    broadcaster.addConnection({ id: 'cashier-dev', restaurantId: RESTAURANT_ID, tableSessionId: null, eventTypes: null, write: (d) => cashierEvents.push(d), close: () => {} });

    // 3. STEP A: Host opens session at Table 1 and assigns Waiter Mateo
    const createSessionRes = await app.inject({
      method: 'POST',
      url: '/api/table-sessions',
      headers: { authorization: `Bearer ${hostToken}` },
      payload: {
        restaurantId: RESTAURANT_ID,
        tableId: TABLE_1_ID,
        customerIds: [CUSTOMER_ID],
        initialWaiterId: WAITER_ID,
      },
    });

    if (createSessionRes.statusCode !== 201) {
      console.log('createSessionRes ERROR:', createSessionRes.statusCode, createSessionRes.body);
    }
    expect(createSessionRes.statusCode).toBe(201);
    const sessionData = JSON.parse(createSessionRes.body);
    const sessionId = sessionData.id;
    expect(sessionId).toBeDefined();

    // Table 1 must now be OCCUPIED
    const table1 = await tableRepo.findById(TABLE_1_ID);
    expect(table1?.status).toBe('OCCUPIED');

    // Customer connects with session-scoped token
    const customerToken = jwtService.sign({ sub: CUSTOMER_ID, type: 'CUSTOMER', restaurantId: RESTAURANT_ID, tableSessionId: sessionId });
    broadcaster.addConnection({ id: 'cust-dev', restaurantId: RESTAURANT_ID, tableSessionId: sessionId, eventTypes: null, write: (d) => customerEvents.push(d), close: () => {} });

    // 4. STEP B: Customer creates an Order
    const createOrderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {
        restaurantId: RESTAURANT_ID,
        tableSessionId: sessionId,
        items: [
          { productId: 'd0000000-0000-0000-0000-000000000009', unitPrice: 18500, quantity: 2, notes: 'A punto' },
        ],
      },
    });

    expect(createOrderRes.statusCode).toBe(201);
    const orderData = JSON.parse(createOrderRes.body);
    const orderId = orderData.id;

    // 5. STEP C: Waiter reviews order and sends it to kitchen
    const sendKitchenRes = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/send-to-kitchen`,
      headers: { authorization: `Bearer ${waiterToken}` },
    });

    expect(sendKitchenRes.statusCode).toBe(200);
    const kitchenEventsReceived = kitchenEvents.filter(e => e.includes('ORDER_SENT_TO_KITCHEN'));
    expect(kitchenEventsReceived.length).toBeGreaterThan(0);

    // 6. STEP D: Kitchen receives order, Chef starts cooking and marks order READY
    const createKitchenRes = await app.inject({
      method: 'POST',
      url: '/api/kitchen/orders',
      headers: { authorization: `Bearer ${chefToken}` },
      payload: {
        restaurantId: RESTAURANT_ID,
        orderId,
        priority: 1,
        notes: 'Mesa 1 - Ojo de Bife a punto',
      },
    });

    expect(createKitchenRes.statusCode).toBe(201);
    const kOrderData = JSON.parse(createKitchenRes.body);
    const kOrderId = kOrderData.id;

    // Chef starts preparation
    const startRes = await app.inject({
      method: 'PATCH',
      url: `/api/kitchen/orders/${kOrderId}/start`,
      headers: { authorization: `Bearer ${chefToken}` },
    });
    expect(startRes.statusCode).toBe(200);

    // Chef marks ready
    const markReadyRes = await app.inject({
      method: 'PATCH',
      url: `/api/kitchen/orders/${kOrderId}/ready`,
      headers: { authorization: `Bearer ${chefToken}` },
    });

    expect(markReadyRes.statusCode).toBe(200);

    // Waiter must receive ORDER_READY notification
    const waiterReadyEvents = waiterEvents.filter(e => e.includes('ORDER_READY') || e.includes('KITCHEN_ORDER_READY'));
    expect(waiterReadyEvents.length).toBeGreaterThan(0);

    // 7. STEP E: Waiter delivers order to table
    const deliverRes = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${orderId}/deliver`,
      headers: { authorization: `Bearer ${waiterToken}` },
    });

    expect(deliverRes.statusCode).toBe(200);

    // 8. STEP F: Customer requests bill
    const callBillRes = await app.inject({
      method: 'POST',
      url: '/api/service/tasks',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {
        restaurantId: RESTAURANT_ID,
        tableSessionId: sessionId,
        type: 'CHECK_ACCOUNT',
        notes: 'Pago en efectivo',
      },
    });

    expect(callBillRes.statusCode).toBe(201);

    // Cashier receives notification
    const cashierTasks = cashierEvents.filter(e => e.includes('SERVICE_TASK_CREATED') || e.includes('CHECK_ACCOUNT'));
    expect(cashierTasks.length).toBeGreaterThan(0);

    // 9. STEP G: Cashier collects payment and closes account
    const accountRes = Account.create({
      restaurantId: RESTAURANT_ID,
      tableSessionId: sessionId,
    });
    expect(accountRes.success).toBe(true);
    let account = accountRes.value;
    const addRes = account.addOrderAmount(37000);
    if (addRes.success) account = addRes.value;
    const payRes = account.registerPayment({
      id: 'e0000000-0000-0000-0000-000000000099',
      amount: 37000,
      method: 'cash',
      registeredAt: new Date(),
    });
    if (payRes.success) account = payRes.value;
    await accountRepo.save(account);

    const closeSessionRes = await app.inject({
      method: 'POST',
      url: `/api/table-sessions/${sessionId}/close`,
      headers: { authorization: `Bearer ${hostToken}` },
    });

    expect(closeSessionRes.statusCode).toBe(200);

    // Table 1 must now be released back to AVAILABLE
    const table1Final = await tableRepo.findById(TABLE_1_ID);
    expect(table1Final?.status).toBe('AVAILABLE');

    // Host received TABLE_RELEASED event
    const tableReleasedEvents = hostEvents.filter(e => e.includes('TABLE_RELEASED'));
    expect(tableReleasedEvents.length).toBeGreaterThan(0);
  });
});
