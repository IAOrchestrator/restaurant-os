import { describe, it, expect } from 'vitest';
import fastify from 'fastify';
import {
  RoleBasedPermissionChecker,
  OperationalResourceScoper,
  type TableRepository,
  type TableSessionRepository,
  type TableDeviceRepository,
  type CustomerRepository,
  type EventLogRepository,
  type EventPublisher,
} from '@restaurant-os/application';
import {
  setupAuth,
} from '@restaurant-os/infrastructure';
import {
  StaffRole,
  Table,
  TableSession,
  TableDevice,
  Customer,
  EventLog,
  EventType,
} from '@restaurant-os/domain';
import { tableRoutes } from '../src/routes/tables';
import { tableSessionRoutes } from '../src/routes/table-sessions';
import { tableDeviceRoutes } from '../src/routes/table-devices';
import { customerRoutes } from '../src/routes/customers';
import { eventRoutes } from '../src/routes/events';

const RESTAURANT_1 = 'a0000000-0000-0000-0000-000000000001';
const RESTAURANT_2 = 'a0000000-0000-0000-0000-000000000002';
const TABLE_1 = 'b0000000-0000-0000-0000-000000000001';
const TABLE_2 = 'b0000000-0000-0000-0000-000000000002';
const SESSION_1 = 'c0000000-0000-0000-0000-000000000001';
const CUSTOMER_1 = 'd0000000-0000-0000-0000-000000000001';
const WAITER_1 = 'e0000000-0000-0000-0000-000000000001';
const RECEPTIONIST_1 = 'f0000000-0000-0000-0000-000000000001';
const ADMIN_1 = 'f0000000-0000-0000-0000-000000000002';
const DEVICE_1 = '90000000-0000-0000-0000-000000000001';

class InMemoryTableRepo implements TableRepository {
  public tables: Map<string, Table> = new Map();
  async findById(id: string) { return this.tables.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.tables.values()).filter((t) => t.restaurantId === restaurantId);
  }
  async save(table: Table) { this.tables.set(table.id, table); }
  async delete(id: string) { this.tables.delete(id); }
}

class InMemorySessionRepo implements TableSessionRepository {
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

class InMemoryTableDeviceRepo implements TableDeviceRepository {
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

class InMemoryCustomerRepo implements CustomerRepository {
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

class InMemoryEventLogRepo implements EventLogRepository {
  public logs: EventLog[] = [];
  async findById(id: string) { return this.logs.find((l) => l.id === id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return this.logs.filter((l) => l.restaurantId === restaurantId);
  }
  async findByAggregateId(aggregateId: string) {
    return this.logs.filter((l) => l.aggregateId === aggregateId);
  }
  async findByTableSessionId(tableSessionId: string) {
    return this.logs.filter((l) => l.tableSessionId === tableSessionId);
  }
  async findByEventType(eventType: string, restaurantId: string) {
    return this.logs.filter((l) => l.eventType === eventType && l.restaurantId === restaurantId);
  }
  async save(eventLog: EventLog) { this.logs.push(eventLog); }
}

class StubEventPublisher implements EventPublisher {
  public events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  async publish(eventType: string, payload: Record<string, unknown>) {
    this.events.push({ eventType, payload });
  }
}

describe('API Route Protection & Operational Endpoints', () => {
  const buildApp = () => {
    const app = fastify();
    const tableRepo = new InMemoryTableRepo();
    const sessionRepo = new InMemorySessionRepo();
    const deviceRepo = new InMemoryTableDeviceRepo();
    const customerRepo = new InMemoryCustomerRepo();
    const eventLogRepo = new InMemoryEventLogRepo();
    const eventPublisher = new StubEventPublisher();

    const getStaffRoles = async (staffId: string) => {
      if (staffId === ADMIN_1 || staffId === 'admin-1') return [StaffRole.ADMIN];
      if (staffId === RECEPTIONIST_1 || staffId === 'receptionist-1') return [StaffRole.RECEPTIONIST];
      if (staffId === WAITER_1 || staffId === 'waiter-1') return [StaffRole.WAITER];
      return [];
    };

    const permissionChecker = new RoleBasedPermissionChecker(getStaffRoles);

    const resourceScoper = new OperationalResourceScoper(
      async (waiterId: string) => (waiterId === WAITER_1 || waiterId === 'waiter-1' ? [SESSION_1] : []),
      async (tableDeviceId: string) => {
        const dev = await deviceRepo.findById(tableDeviceId);
        if (!dev || !dev.tableId) return null;
        const active = await sessionRepo.findActiveByTableId(dev.tableId);
        return active?.id ?? null;
      },
      getStaffRoles,
    );

    setupAuth(app, {
      permissionChecker,
      resourceScoper,
    });

    app.register(tableRoutes, { prefix: '/api/tables', tableRepo, sessionRepo, eventPublisher });
    app.register(tableSessionRoutes, { prefix: '/api/table-sessions', tableRepo, sessionRepo, eventPublisher });
    app.register(tableDeviceRoutes, { prefix: '/api/table-devices', deviceRepo, tableRepo, sessionRepo, eventPublisher });
    app.register(customerRoutes, { prefix: '/api/customers', customerRepo });
    app.register(eventRoutes, { prefix: '/api/events', eventLogRepo });

    return { app, tableRepo, sessionRepo, deviceRepo, customerRepo, eventLogRepo, eventPublisher };
  };

  it('rejects unauthenticated/unauthorized customer accessing tables route with 403', async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/tables?restaurantId=${RESTAURANT_1}`,
      headers: {
        'x-actor-type': 'CUSTOMER',
        'x-actor-id': CUSTOMER_1,
        'x-restaurant-id': RESTAURANT_1,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Forbidden');
  });

  it('allows staff with TABLES_READ to list tables', async () => {
    const { app, tableRepo } = buildApp();
    const table = Table.create({
      id: TABLE_1,
      restaurantId: RESTAURANT_1,
      number: 5,
      capacity: 4,
    });
    if (table.success) await tableRepo.save(table.value);

    const res = await app.inject({
      method: 'GET',
      url: `/api/tables?restaurantId=${RESTAURANT_1}`,
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': RECEPTIONIST_1,
        'x-restaurant-id': RESTAURANT_1,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].number).toBe(5);
  });

  it('prevents cross-restaurant query even if staff has permission', async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/tables?restaurantId=${RESTAURANT_2}`,
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': RECEPTIONIST_1,
        'x-restaurant-id': RESTAURANT_1,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Access denied to other restaurant data');
  });

  it('supports changing table session table via PATCH /api/table-sessions/:id/change-table', async () => {
    const { app, tableRepo, sessionRepo } = buildApp();

    const table1 = Table.create({ id: TABLE_1, restaurantId: RESTAURANT_1, number: 1, capacity: 4 }).value!;
    const table2 = Table.create({ id: TABLE_2, restaurantId: RESTAURANT_1, number: 2, capacity: 4 }).value!;
    await tableRepo.save(table1);
    await tableRepo.save(table2);

    const session = TableSession.create({
      id: SESSION_1,
      restaurantId: RESTAURANT_1,
      tableId: TABLE_1,
      initialWaiterId: WAITER_1,
    }).value!;
    await sessionRepo.save(session);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/table-sessions/${SESSION_1}/change-table`,
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': RECEPTIONIST_1,
        'x-restaurant-id': RESTAURANT_1,
      },
      payload: {
        newTableId: TABLE_2,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tableId).toBe(TABLE_2);
    expect(body.tableHistory).toHaveLength(2);
  });

  it('supports adding and removing customers from session', async () => {
    const { app, sessionRepo } = buildApp();

    const session = TableSession.create({
      id: SESSION_1,
      restaurantId: RESTAURANT_1,
      tableId: TABLE_1,
      initialWaiterId: WAITER_1,
    }).value!;
    await sessionRepo.save(session);

    // Add customer
    const addRes = await app.inject({
      method: 'POST',
      url: `/api/table-sessions/${SESSION_1}/customers`,
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': WAITER_1,
        'x-restaurant-id': RESTAURANT_1,
      },
      payload: {
        customerId: CUSTOMER_1,
      },
    });

    expect(addRes.statusCode).toBe(200);
    const addBody = JSON.parse(addRes.body);
    expect(addBody.customerIds).toContain(CUSTOMER_1);

    // Remove customer
    const removeRes = await app.inject({
      method: 'DELETE',
      url: `/api/table-sessions/${SESSION_1}/customers/${CUSTOMER_1}`,
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': WAITER_1,
        'x-restaurant-id': RESTAURANT_1,
      },
    });

    expect(removeRes.statusCode).toBe(200);
    const removeBody = JSON.parse(removeRes.body);
    expect(removeBody.customerIds).not.toContain(CUSTOMER_1);
  });

  it('supports customer creation, retrieval, and updates', async () => {
    const { app } = buildApp();

    // Create customer
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      payload: {
        id: CUSTOMER_1,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '12345678',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.name).toBe('John Doe');

    // Get customer
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/customers/${CUSTOMER_1}`,
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': ADMIN_1,
        'x-restaurant-id': RESTAURANT_1,
      },
    });

    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.body).email).toBe('john@example.com');
  });

  it('retrieves events by tableSessionId', async () => {
    const { app, eventLogRepo } = buildApp();

    const event = EventLog.create({
      id: 'e0000000-0000-0000-0000-000000000001',
      eventType: EventType.TABLE_CHANGED,
      restaurantId: RESTAURANT_1,
      aggregateType: 'TableSession',
      aggregateId: SESSION_1,
      tableSessionId: SESSION_1,
    }).value!;
    await eventLogRepo.save(event);

    const res = await app.inject({
      method: 'GET',
      url: `/api/events/session/${SESSION_1}`,
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': ADMIN_1,
        'x-restaurant-id': RESTAURANT_1,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].tableSessionId).toBe(SESSION_1);
    expect(body[0].eventType).toBe(EventType.TABLE_CHANGED);
  });

  it('manages TableDevice lifecycle, table association and session query', async () => {
    const { app, tableRepo, sessionRepo } = buildApp();

    const table = Table.create({ id: TABLE_1, restaurantId: RESTAURANT_1, number: 1, capacity: 4 }).value!;
    await tableRepo.save(table);

    const session = TableSession.create({
      id: SESSION_1,
      restaurantId: RESTAURANT_1,
      tableId: TABLE_1,
      initialWaiterId: WAITER_1,
    }).value!;
    await sessionRepo.save(session);

    // Register device
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/table-devices',
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': ADMIN_1,
        'x-restaurant-id': RESTAURANT_1,
      },
      payload: {
        id: DEVICE_1,
        restaurantId: RESTAURANT_1,
        name: 'Tablet Table 1',
      },
    });

    expect(registerRes.statusCode).toBe(201);
    const regBody = JSON.parse(registerRes.body);
    expect(regBody.name).toBe('Tablet Table 1');
    expect(regBody.tableId).toBeNull();

    // Associate to Table 1
    const assocRes = await app.inject({
      method: 'POST',
      url: `/api/table-devices/${DEVICE_1}/associate`,
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': RECEPTIONIST_1,
        'x-restaurant-id': RESTAURANT_1,
      },
      payload: {
        tableId: TABLE_1,
      },
    });

    expect(assocRes.statusCode).toBe(200);
    const assocBody = JSON.parse(assocRes.body);
    expect(assocBody.tableId).toBe(TABLE_1);

    // Query active session for device as TABLE_DEVICE actor
    const sessionRes = await app.inject({
      method: 'GET',
      url: `/api/table-devices/${DEVICE_1}/session`,
      headers: {
        'x-actor-type': 'TABLE_DEVICE',
        'x-actor-id': DEVICE_1,
        'x-restaurant-id': RESTAURANT_1,
      },
    });

    expect(sessionRes.statusCode).toBe(200);
    const sessionBody = JSON.parse(sessionRes.body);
    expect(sessionBody.id).toBe(SESSION_1);

    // Disassociate table
    const disassocRes = await app.inject({
      method: 'DELETE',
      url: `/api/table-devices/${DEVICE_1}/associate`,
      headers: {
        'x-actor-type': 'STAFF',
        'x-actor-id': ADMIN_1,
        'x-restaurant-id': RESTAURANT_1,
      },
    });

    expect(disassocRes.statusCode).toBe(200);
    const disassocBody = JSON.parse(disassocRes.body);
    expect(disassocBody.tableId).toBeNull();
  });
});
