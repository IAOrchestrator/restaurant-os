import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import {
  JwtService,
  setupAuth,
} from '@restaurant-os/infrastructure';
import {
  RoleBasedPermissionChecker,
  OperationalResourceScoper,
  type TableRepository,
  type TableSessionRepository,
  type TableDeviceRepository,
  type CustomerRepository,
  type OrderRepository,
  type ServiceTaskRepository,
  type EventPublisher,
  type TransactionRunner,
} from '@restaurant-os/application';
import {
  StaffRole,
  Table,
  TableSession,
  TableDevice,
  Customer,
  Order,
  ServiceTask,
} from '@restaurant-os/domain';
import { tableSessionRoutes } from '../src/routes/table-sessions';
import { tableDeviceRoutes } from '../src/routes/table-devices';
import { orderRoutes } from '../src/routes/orders';
import { serviceRoutes } from '../src/routes/service';
import { customerRoutes } from '../src/routes/customers';

const RESTAURANT_1 = 'a0000000-0000-0000-0000-000000000001';
const RESTAURANT_2 = 'a0000000-0000-0000-0000-000000000002';

const TABLE_1 = 'b0000000-0000-0000-0000-000000000001';
const TABLE_2 = 'b0000000-0000-0000-0000-000000000002';
const TABLE_3 = 'b0000000-0000-0000-0000-000000000003';

const DEVICE_1 = 'd0000000-0000-0000-0000-000000000001';
const DEVICE_2 = 'd0000000-0000-0000-0000-000000000002';

const SESSION_1 = 'c0000000-0000-0000-0000-000000000001'; // Table 1 (Restaurant 1) - Device 1 - Waiter 1 - Customer 1
const SESSION_2 = 'c0000000-0000-0000-0000-000000000002'; // Table 2 (Restaurant 1) - Device 2 - Waiter 2 - Customer 2
const SESSION_3 = 'c0000000-0000-0000-0000-000000000003'; // Table 3 (Restaurant 2) - Cross-tenant

const CUSTOMER_1 = 'f0000000-0000-0000-0000-000000000001';
const CUSTOMER_2 = 'f0000000-0000-0000-0000-000000000002';

const PRODUCT_1 = 'e0000000-0000-0000-0000-000000000001';
const PRODUCT_2 = 'e0000000-0000-0000-0000-000000000002';

const WAITER_1 = '90000000-0000-0000-0000-000000000001';
const WAITER_2 = '90000000-0000-0000-0000-000000000002';
const ADMIN_1 = '90000000-0000-0000-0000-000000000003';

class MockTableRepo implements TableRepository {
  public tables: Map<string, Table> = new Map();
  async findById(id: string) { return this.tables.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.tables.values()).filter((t) => t.restaurantId === restaurantId);
  }
  async save(table: Table) { this.tables.set(table.id, table); }
  async delete(id: string) { this.tables.delete(id); }
}

class MockSessionRepo implements TableSessionRepository {
  public sessions: Map<string, TableSession> = new Map();
  async findById(id: string) { return this.sessions.get(id) ?? null; }
  async findActiveByTableId(tableId: string) {
    return Array.from(this.sessions.values()).find((s) => s.tableId === tableId && s.status !== 'CLOSED') ?? null;
  }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.sessions.values()).filter((s) => s.restaurantId === restaurantId);
  }
  async save(session: TableSession) { this.sessions.set(session.id, session); }
}

class MockDeviceRepo implements TableDeviceRepository {
  public devices: Map<string, TableDevice> = new Map();
  async findById(id: string) { return this.devices.get(id) ?? null; }
  async findByTableId(tableId: string) {
    return Array.from(this.devices.values()).find((d) => d.tableId === tableId) ?? null;
  }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.devices.values()).filter((d) => d.restaurantId === restaurantId);
  }
  async save(device: TableDevice) { this.devices.set(device.id, device); }
  async delete(id: string) { this.devices.delete(id); }
}

class MockCustomerRepo implements CustomerRepository {
  public customers: Map<string, Customer> = new Map();
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

class MockOrderRepo implements OrderRepository {
  public orders: Map<string, Order> = new Map();
  async findById(id: string) { return this.orders.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.orders.values()).filter((o) => o.restaurantId === restaurantId);
  }
  async findByTableSessionId(tableSessionId: string) {
    return Array.from(this.orders.values()).filter((o) => o.tableSessionId === tableSessionId);
  }
  async save(order: Order) { this.orders.set(order.id, order); }
}

class MockServiceTaskRepo implements ServiceTaskRepository {
  public tasks: Map<string, ServiceTask> = new Map();
  async findById(id: string) { return this.tasks.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.tasks.values()).filter((t) => t.restaurantId === restaurantId);
  }
  async findByTableSessionId(tableSessionId: string) {
    return Array.from(this.tasks.values()).filter((t) => t.tableSessionId === tableSessionId);
  }
  async save(task: ServiceTask) { this.tasks.set(task.id, task); }
}

class MockEventPublisher implements EventPublisher {
  public events: any[] = [];
  async publish(event: any) { this.events.push(event); }
}

class MockTxRunner implements TransactionRunner {
  async run<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return fn({});
  }
}

describe('Step 3.4 — Fine-Grained Contextual Resource Scoping & IDOR Defense', () => {
  let app: FastifyInstance;
  const jwtService = new JwtService('test_jwt_secret_3_4');
  const tableRepo = new MockTableRepo();
  const sessionRepo = new MockSessionRepo();
  const deviceRepo = new MockDeviceRepo();
  const customerRepo = new MockCustomerRepo();
  const orderRepo = new MockOrderRepo();
  const serviceTaskRepo = new MockServiceTaskRepo();
  const eventPublisher = new MockEventPublisher();
  const txRunner = new MockTxRunner();

  beforeAll(async () => {
    app = fastify();

    const getStaffRoles = async (staffId: string) => {
      if (staffId === ADMIN_1) return [StaffRole.ADMIN];
      if (staffId === WAITER_1 || staffId === WAITER_2) return [StaffRole.WAITER];
      return [];
    };

    const getWaiterTableSessionIds = async (waiterId: string) => {
      if (waiterId === WAITER_1) return [SESSION_1];
      if (waiterId === WAITER_2) return [SESSION_2];
      return [];
    };

    const getTableDeviceSessionId = async (tableDeviceId: string) => {
      if (tableDeviceId === DEVICE_1) return SESSION_1;
      if (tableDeviceId === DEVICE_2) return SESSION_2;
      return null;
    };

    const getTableDeviceTableId = async (tableDeviceId: string) => {
      if (tableDeviceId === DEVICE_1) return TABLE_1;
      if (tableDeviceId === DEVICE_2) return TABLE_2;
      return null;
    };

    const getCustomerSessionIds = async (customerId: string) => {
      if (customerId === CUSTOMER_1) return [SESSION_1];
      if (customerId === CUSTOMER_2) return [SESSION_2];
      return [];
    };

    const permissionChecker = new RoleBasedPermissionChecker(getStaffRoles);
    const resourceScoper = new OperationalResourceScoper(
      getWaiterTableSessionIds,
      getTableDeviceSessionId,
      getStaffRoles,
      getTableDeviceTableId,
      getCustomerSessionIds,
    );

    setupAuth(app, {
      permissionChecker,
      resourceScoper,
      jwtService,
    });

    await app.register(tableSessionRoutes, { prefix: '/api/table-sessions', tableRepo, sessionRepo, eventPublisher, txRunner });
    await app.register(tableDeviceRoutes, { prefix: '/api/table-devices', deviceRepo, tableRepo, sessionRepo, eventPublisher });
    await app.register(orderRoutes, { prefix: '/api/orders', orderRepo, sessionRepo, tableRepo, txRunner, eventPublisher });
    await app.register(serviceRoutes, { prefix: '/api/service', serviceTaskRepo, eventPublisher });
    await app.register(customerRoutes, { prefix: '/api/customers', customerRepo });

    // Seed test entities
    const t1 = Table.create({ id: TABLE_1, restaurantId: RESTAURANT_1, number: 1, capacity: 4 }).value!.occupy().value!;
    const t2 = Table.create({ id: TABLE_2, restaurantId: RESTAURANT_1, number: 2, capacity: 4 }).value!.occupy().value!;
    const t3 = Table.create({ id: TABLE_3, restaurantId: RESTAURANT_2, number: 1, capacity: 4 }).value!.occupy().value!;
    await tableRepo.save(t1);
    await tableRepo.save(t2);
    await tableRepo.save(t3);

    const d1 = TableDevice.create({ id: DEVICE_1, restaurantId: RESTAURANT_1, name: 'Tablet Mesa 1', tableId: TABLE_1 }).value!;
    const d2 = TableDevice.create({ id: DEVICE_2, restaurantId: RESTAURANT_1, name: 'Tablet Mesa 2', tableId: TABLE_2 }).value!;
    await deviceRepo.save(d1);
    await deviceRepo.save(d2);

    const s1 = TableSession.create({ id: SESSION_1, restaurantId: RESTAURANT_1, tableId: TABLE_1, initialWaiterId: WAITER_1 }).value!;
    const s2 = TableSession.create({ id: SESSION_2, restaurantId: RESTAURANT_1, tableId: TABLE_2, initialWaiterId: WAITER_2 }).value!;
    const s3 = TableSession.create({ id: SESSION_3, restaurantId: RESTAURANT_2, tableId: TABLE_3, initialWaiterId: 'waiter-other' }).value!;
    await sessionRepo.save(s1);
    await sessionRepo.save(s2);
    await sessionRepo.save(s3);

    const c1 = Customer.create({ id: CUSTOMER_1, name: 'Alice Customer', email: 'alice@example.com' }).value!;
    const c2 = Customer.create({ id: CUSTOMER_2, name: 'Bob Customer', email: 'bob@example.com' }).value!;
    await customerRepo.save(c1);
    await customerRepo.save(c2);

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. TABLE_DEVICE Fine-Grained Scoping', () => {
    it('1.1. Device 1 can create order for its own table session (SESSION_1)', async () => {
      const device1Token = jwtService.sign({
        sub: DEVICE_1,
        type: 'TABLE_DEVICE',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: {
          authorization: `Bearer ${device1Token}`,
        },
        payload: {
          restaurantId: RESTAURANT_1,
          tableSessionId: SESSION_1,
          items: [{ productId: PRODUCT_1, quantity: 2, unitPrice: 10, notes: 'Sin sal' }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).tableSessionId).toBe(SESSION_1);
    });

    it('1.2. Device 1 CANNOT create order for another table session in same restaurant (SESSION_2)', async () => {
      const device1Token = jwtService.sign({
        sub: DEVICE_1,
        type: 'TABLE_DEVICE',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: {
          authorization: `Bearer ${device1Token}`,
        },
        payload: {
          restaurantId: RESTAURANT_1,
          tableSessionId: SESSION_2, // Belongs to Table 2
          items: [{ productId: PRODUCT_1, quantity: 1, unitPrice: 10 }],
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Access denied to table session outside actor scope');
    });

    it('1.3. Device 1 CANNOT create order for another restaurant (SESSION_3)', async () => {
      const device1Token = jwtService.sign({
        sub: DEVICE_1,
        type: 'TABLE_DEVICE',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: {
          authorization: `Bearer ${device1Token}`,
        },
        payload: {
          restaurantId: RESTAURANT_2,
          tableSessionId: SESSION_3,
          items: [{ productId: PRODUCT_1, quantity: 1, unitPrice: 10 }],
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('1.4. Device 1 can create service task for its own session', async () => {
      const device1Token = jwtService.sign({
        sub: DEVICE_1,
        type: 'TABLE_DEVICE',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/service/tasks',
        headers: {
          authorization: `Bearer ${device1Token}`,
        },
        payload: {
          restaurantId: RESTAURANT_1,
          tableSessionId: SESSION_1,
          type: 'CUSTOMER_REQUEST',
          notes: 'Necesitamos cubiertos',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).tableSessionId).toBe(SESSION_1);
    });

    it('1.5. Device 1 CANNOT create service task for another session (SESSION_2)', async () => {
      const device1Token = jwtService.sign({
        sub: DEVICE_1,
        type: 'TABLE_DEVICE',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/service/tasks',
        headers: {
          authorization: `Bearer ${device1Token}`,
        },
        payload: {
          restaurantId: RESTAURANT_1,
          tableSessionId: SESSION_2,
          type: 'CHECK_ACCOUNT',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Access denied to table session outside actor scope');
    });

    it('1.6. Device 1 can query its own active session via GET /api/table-devices/:id/session', async () => {
      const device1Token = jwtService.sign({
        sub: DEVICE_1,
        type: 'TABLE_DEVICE',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/table-devices/${DEVICE_1}/session`,
        headers: {
          authorization: `Bearer ${device1Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe(SESSION_1);
    });

    it('1.7. Device 1 CANNOT query another tablet session (DEVICE_2)', async () => {
      const device1Token = jwtService.sign({
        sub: DEVICE_1,
        type: 'TABLE_DEVICE',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/table-devices/${DEVICE_2}/session`,
        headers: {
          authorization: `Bearer ${device1Token}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('2. STAFF / WAITER Scoping', () => {
    it('2.1. Waiter 1 can access their assigned session (SESSION_1)', async () => {
      const waiter1Token = jwtService.sign({
        sub: WAITER_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.WAITER],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/table-sessions/${SESSION_1}`,
        headers: {
          authorization: `Bearer ${waiter1Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe(SESSION_1);
    });

    it('2.2. Waiter 1 CANNOT access unassigned session in same restaurant (SESSION_2)', async () => {
      const waiter1Token = jwtService.sign({
        sub: WAITER_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.WAITER],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/table-sessions/${SESSION_2}`,
        headers: {
          authorization: `Bearer ${waiter1Token}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Forbidden: no access to table-session');
    });

    it('2.3. Waiter 1 can close their assigned session (SESSION_1)', async () => {
      const waiter1Token = jwtService.sign({
        sub: WAITER_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.WAITER],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/table-sessions/${SESSION_1}/close`,
        headers: {
          authorization: `Bearer ${waiter1Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('2.4. Waiter 1 CANNOT close unassigned session (SESSION_2)', async () => {
      const waiter1Token = jwtService.sign({
        sub: WAITER_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.WAITER],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/table-sessions/${SESSION_2}/close`,
        headers: {
          authorization: `Bearer ${waiter1Token}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Forbidden: no access to table-session');
    });
  });

  describe('3. CUSTOMER Scoping', () => {
    it('3.1. Customer 1 can create order for their own session (SESSION_1)', async () => {
      const customer1Token = jwtService.sign({
        sub: CUSTOMER_1,
        type: 'CUSTOMER',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: {
          authorization: `Bearer ${customer1Token}`,
        },
        payload: {
          restaurantId: RESTAURANT_1,
          tableSessionId: SESSION_1,
          items: [{ productId: PRODUCT_2, quantity: 1, unitPrice: 15 }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).tableSessionId).toBe(SESSION_1);
    });

    it('3.2. Customer 1 CANNOT create order for another session (SESSION_2)', async () => {
      const customer1Token = jwtService.sign({
        sub: CUSTOMER_1,
        type: 'CUSTOMER',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: {
          authorization: `Bearer ${customer1Token}`,
        },
        payload: {
          restaurantId: RESTAURANT_1,
          tableSessionId: SESSION_2,
          items: [{ productId: PRODUCT_2, quantity: 1, unitPrice: 15 }],
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Access denied to table session outside actor scope');
    });
  });
});
