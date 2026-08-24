import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import {
  JwtService,
  setupAuth,
} from '@restaurant-os/infrastructure';
import {
  RoleBasedPermissionChecker,
  OperationalResourceScoper,
  GetLiveOperationsUseCase,
  GetRawMaterialsUseCase,
  type TableRepository,
  type TableSessionRepository,
  type CustomerRepository,
  type EventPublisher,
} from '@restaurant-os/application';
import {
  StaffRole,
  Table,
  TableSession,
  Customer,
} from '@restaurant-os/domain';
import { inventoryRoutes } from '../src/routes/inventory';
import { analyticsRoutes } from '../src/routes/analytics';
import { tableSessionRoutes } from '../src/routes/table-sessions';
import { customerRoutes } from '../src/routes/customers';

const RESTAURANT_1 = 'a0000000-0000-0000-0000-000000000001';
const RESTAURANT_2 = 'a0000000-0000-0000-0000-000000000002';
const TABLE_1 = 'b0000000-0000-0000-0000-000000000001';
const TABLE_2 = 'b0000000-0000-0000-0000-000000000002';
const SESSION_1 = 'c0000000-0000-0000-0000-000000000001';
const SESSION_2 = 'c0000000-0000-0000-0000-000000000002';
const CUSTOMER_1 = 'd0000000-0000-0000-0000-000000000001';
const CUSTOMER_2 = 'd0000000-0000-0000-0000-000000000002';
const WAITER_1 = 'e0000000-0000-0000-0000-000000000001';
const KITCHEN_1 = 'c0000000-0000-0000-0000-000000000002';
const ADMIN_1 = 'f0000000-0000-0000-0000-000000000002';

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

class MockEventPublisher implements EventPublisher {
  public events: any[] = [];
  async publish(event: any) { this.events.push(event); }
}

describe('Step 3.3 — Comprehensive Endpoint Hardening & IDOR Protection', () => {
  let app: FastifyInstance;
  const jwtService = new JwtService('test_jwt_secret_3_3');
  const tableRepo = new MockTableRepo();
  const sessionRepo = new MockSessionRepo();
  const customerRepo = new MockCustomerRepo();
  const eventPublisher = new MockEventPublisher();

  beforeAll(async () => {
    app = fastify();

    const getStaffRoles = async (staffId: string) => {
      if (staffId === ADMIN_1) return [StaffRole.ADMIN];
      if (staffId === WAITER_1) return [StaffRole.WAITER];
      if (staffId === KITCHEN_1) return [StaffRole.KITCHEN];
      return [];
    };

    const permissionChecker = new RoleBasedPermissionChecker(getStaffRoles);
    const resourceScoper = new OperationalResourceScoper(
      async (waiterId: string) => (waiterId === WAITER_1 ? [SESSION_1] : []),
      async () => null,
      getStaffRoles,
    );

    setupAuth(app, {
      permissionChecker,
      resourceScoper,
      jwtService,
    });

    await app.register(inventoryRoutes, { prefix: '/api/inventory' });
    await app.register(analyticsRoutes, { prefix: '/api/analytics' });
    await app.register(tableSessionRoutes, { prefix: '/api/table-sessions', tableRepo, sessionRepo, eventPublisher });
    await app.register(customerRoutes, { prefix: '/api/customers', customerRepo });

    // Seed mock data
    const table1 = Table.create({ id: TABLE_1, restaurantId: RESTAURANT_1, number: 1, capacity: 4 }).value!;
    const table2 = Table.create({ id: TABLE_2, restaurantId: RESTAURANT_2, number: 2, capacity: 4 }).value!;
    await tableRepo.save(table1);
    await tableRepo.save(table2);

    const session1 = TableSession.create({ id: SESSION_1, restaurantId: RESTAURANT_1, tableId: TABLE_1, initialWaiterId: WAITER_1 }).value!;
    const session2 = TableSession.create({ id: SESSION_2, restaurantId: RESTAURANT_2, tableId: TABLE_2, initialWaiterId: 'other-waiter' }).value!;
    await sessionRepo.save(session1);
    await sessionRepo.save(session2);

    const customer1 = Customer.create({ id: CUSTOMER_1, name: 'Alice Customer', email: 'alice@example.com' }).value!;
    const customer2 = Customer.create({ id: CUSTOMER_2, name: 'Bob Customer', email: 'bob@example.com' }).value!;
    await customerRepo.save(customer1);
    await customerRepo.save(customer2);

    await app.ready();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  describe('1. Inventory Route Protection', () => {
    it('1.1. Denies unauthenticated/anonymous access to /api/inventory/raw-materials with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/inventory/raw-materials?restaurantId=${RESTAURANT_1}`,
      });

      expect(res.statusCode).toBe(403);
    });

    it('1.2. Denies access to inventory when actor lacks CATALOG_MANAGE permission (e.g. Kitchen role)', async () => {
      const kitchenToken = jwtService.sign({
        sub: KITCHEN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.KITCHEN],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/inventory/raw-materials?restaurantId=${RESTAURANT_1}`,
        headers: {
          authorization: `Bearer ${kitchenToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('1.3. Denies cross-tenant inventory access even for Admin of another restaurant', async () => {
      const adminToken = jwtService.sign({
        sub: ADMIN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.ADMIN],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/inventory/raw-materials?restaurantId=${RESTAURANT_2}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Access denied to other restaurant data');
    });

    it('1.4. Denies POST /api/inventory/raw-materials without CATALOG_MANAGE permission (e.g. Waiter role)', async () => {
      const waiterToken = jwtService.sign({
        sub: WAITER_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.WAITER],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/inventory/raw-materials',
        headers: {
          authorization: `Bearer ${waiterToken}`,
        },
        payload: {
          restaurantId: RESTAURANT_1,
          name: 'Tomato Sauce',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('1.5. Allows Admin with CATALOG_MANAGE to list raw materials for own restaurant', async () => {
      vi.spyOn(GetRawMaterialsUseCase.prototype, 'execute').mockResolvedValueOnce([
        { id: 'mat-1', restaurantId: RESTAURANT_1, name: 'Harina', unit: 'KG', currentStock: 50, minStockAlert: 10, unitCost: 1.5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ]);

      const adminToken = jwtService.sign({
        sub: ADMIN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.ADMIN],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/inventory/raw-materials?restaurantId=${RESTAURANT_1}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const list = JSON.parse(res.body);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Harina');
    });
  });

  describe('2. Analytics Route Protection', () => {
    it('2.1. Denies unauthenticated access to /api/analytics/live-operations with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/analytics/live-operations?restaurantId=${RESTAURANT_1}`,
      });

      expect(res.statusCode).toBe(403);
    });

    it('2.2. Denies access to live-operations when actor lacks ANALYTICS_READ (e.g. Waiter)', async () => {
      const waiterToken = jwtService.sign({
        sub: WAITER_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.WAITER],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/analytics/live-operations?restaurantId=${RESTAURANT_1}`,
        headers: {
          authorization: `Bearer ${waiterToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('2.3. Denies cross-tenant analytics access', async () => {
      const adminToken = jwtService.sign({
        sub: ADMIN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.ADMIN],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/analytics/live-operations?restaurantId=${RESTAURANT_2}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Access denied to other restaurant data');
    });

    it('2.4. Allows authorized Admin with ANALYTICS_READ on own restaurant', async () => {
      vi.spyOn(GetLiveOperationsUseCase.prototype, 'execute').mockResolvedValueOnce({
        restaurantId: RESTAURANT_1,
        generatedAt: new Date().toISOString(),
        tables: { total: 1, available: 1, occupied: 0, reserved: 0, dirty: 0, activeSessionsCount: 0 },
        waitlist: { waitingCount: 0, avgWaitMinutes: 0 },
        kitchen: { activeTickets: 0, pendingByStation: { HOT: 0, COLD: 0, GRILL: 0, DESSERT: 0, BEV: 0 }, delayedOrdersCount: 0 },
        billing: { openAccountsCount: 0, totalPendingAmount: 0, totalCollectedToday: 0 },
        service: { pendingTasksCount: 0, urgentTasksCount: 0 },
        orders: { activeOrdersCount: 0, deliveredLastHour: 0 },
        inventoryAlerts: { lowStockCount: 0, criticalItems: [] },
      });

      const adminToken = jwtService.sign({
        sub: ADMIN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.ADMIN],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/analytics/live-operations?restaurantId=${RESTAURANT_1}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.tables).toBeDefined();
      expect(body.restaurantId).toBe(RESTAURANT_1);
    });
  });

  describe('3. Table Sessions Cross-Tenant & IDOR Protection', () => {
    it('3.1. Denies accessing another restaurant session via GET /api/table-sessions/:id (IDOR prevention)', async () => {
      const adminToken = jwtService.sign({
        sub: ADMIN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.ADMIN],
      });

      // Session 2 belongs to RESTAURANT_2
      const res = await app.inject({
        method: 'GET',
        url: `/api/table-sessions/${SESSION_2}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Access denied to other restaurant data');
    });

    it('3.2. Denies closing another restaurant session via POST /api/table-sessions/:id/close', async () => {
      const adminToken = jwtService.sign({
        sub: ADMIN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.ADMIN],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/table-sessions/${SESSION_2}/close`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Access denied to other restaurant data');
    });

    it('3.3. Denies changing waiter on another restaurant session via POST /api/table-sessions/:id/change-waiter', async () => {
      const adminToken = jwtService.sign({
        sub: ADMIN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.ADMIN],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/table-sessions/${SESSION_2}/change-waiter`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          newWaiterId: WAITER_1,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Access denied to other restaurant data');
    });

    it('3.4. Denies customer management on session without permission or cross-tenant', async () => {
      const adminToken = jwtService.sign({
        sub: ADMIN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.ADMIN],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/table-sessions/${SESSION_2}/customers`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          customerId: CUSTOMER_1,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).message).toContain('Access denied to other restaurant data');
    });
  });

  describe('4. Customer Profile Protection & Self-Modification Control', () => {
    it('4.1. Prevents Customer 1 from modifying Customer 2 profile (IDOR protection)', async () => {
      const customer1Token = jwtService.sign({
        sub: CUSTOMER_1,
        type: 'CUSTOMER',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/customers/${CUSTOMER_2}`,
        headers: {
          authorization: `Bearer ${customer1Token}`,
        },
        payload: {
          name: 'Hacked Name',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toBe('Forbidden');
    });

    it('4.2. Allows Customer 1 to modify their own profile', async () => {
      const customer1Token = jwtService.sign({
        sub: CUSTOMER_1,
        type: 'CUSTOMER',
        restaurantId: RESTAURANT_1,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/customers/${CUSTOMER_1}`,
        headers: {
          authorization: `Bearer ${customer1Token}`,
        },
        payload: {
          name: 'Alice Updated',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).name).toBe('Alice Updated');
    });

    it('4.3. Allows authorized Staff (Admin with CUSTOMER_MANAGE) to modify customer profile', async () => {
      const adminToken = jwtService.sign({
        sub: ADMIN_1,
        type: 'STAFF',
        restaurantId: RESTAURANT_1,
        roles: [StaffRole.ADMIN],
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/customers/${CUSTOMER_2}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Bob Managed by Staff',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).name).toBe('Bob Managed by Staff');
    });

    it('4.4. Denies unauthenticated actor from modifying customer profile', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/customers/${CUSTOMER_1}`,
        payload: {
          name: 'Anonymous Hacker',
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('5. Production Environment Defense Against Header Spoofing', () => {
    it('5.1. In production (NODE_ENV=production), x-actor-* headers are strictly IGNORED and cannot bypass auth', async () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        const res = await app.inject({
          method: 'GET',
          url: `/api/analytics/live-operations?restaurantId=${RESTAURANT_1}`,
          headers: {
            'x-actor-type': 'STAFF',
            'x-actor-id': ADMIN_1,
            'x-restaurant-id': RESTAURANT_1,
          },
        });

        // In production, without valid Bearer token, request is treated as anonymous customer → 403
        expect(res.statusCode).toBe(403);
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });
});
