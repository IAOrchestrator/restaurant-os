import { describe, it, expect } from 'vitest';
import {
  RegisterTableDeviceUseCase,
  AssociateTableDeviceUseCase,
  DisassociateTableDeviceUseCase,
  GetTableDeviceUseCase,
  ListTableDevicesUseCase,
  GetTableDeviceSessionUseCase,
  type TableDeviceRepository,
  type TableRepository,
  type TableSessionRepository,
  type EventPublisher,
} from '../src';
import { TableDevice, Table, TableSession } from '@restaurant-os/domain';

class InMemoryTableDeviceRepo implements TableDeviceRepository {
  public devices = new Map<string, TableDevice>();
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

class RecordingEventPublisher implements EventPublisher {
  public events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  async publish(eventOrType: any, payload?: any) {
    if (typeof eventOrType === 'object' && eventOrType !== null && 'type' in eventOrType) {
      this.events.push({ eventType: eventOrType.type, payload: eventOrType.payload });
    } else {
      this.events.push({ eventType: eventOrType, payload: payload ?? {} });
    }
  }
}

describe('TableDevice Application Use Cases', () => {
  const REST_ID = 'rest-1';
  const DEV_ID = 'dev-1';
  const TABLE_1 = 'table-1';
  const TABLE_2 = 'table-2';

  it('registers a new table device and publishes event', async () => {
    const deviceRepo = new InMemoryTableDeviceRepo();
    const eventPublisher = new RecordingEventPublisher();

    const registerUseCase = new RegisterTableDeviceUseCase(deviceRepo, eventPublisher);
    const device = await registerUseCase.execute({
      id: DEV_ID,
      restaurantId: REST_ID,
      name: 'Tablet 1',
    });

    expect(device.id).toBe(DEV_ID);
    expect(device.tableId).toBeNull();
    expect(eventPublisher.events).toHaveLength(1);
    expect(eventPublisher.events[0].eventType).toBe('TABLE_DEVICE_REGISTERED');
  });

  it('associates device to table and disassociates', async () => {
    const deviceRepo = new InMemoryTableDeviceRepo();
    const tableRepo = new InMemoryTableRepo();
    const eventPublisher = new RecordingEventPublisher();

    const table = Table.create({ id: TABLE_1, restaurantId: REST_ID, number: 1, capacity: 4 }).value!;
    await tableRepo.save(table);

    const device = TableDevice.create({ id: DEV_ID, restaurantId: REST_ID, name: 'Tablet 1' }).value!;
    await deviceRepo.save(device);

    const assocUseCase = new AssociateTableDeviceUseCase(deviceRepo, tableRepo, eventPublisher);
    const associated = await assocUseCase.execute({
      deviceId: DEV_ID,
      tableId: TABLE_1,
    });

    expect(associated.tableId).toBe(TABLE_1);
    expect(eventPublisher.events[0].eventType).toBe('TABLE_DEVICE_ASSOCIATED');

    const disassocUseCase = new DisassociateTableDeviceUseCase(deviceRepo, eventPublisher);
    const disassociated = await disassocUseCase.execute({ deviceId: DEV_ID });

    expect(disassociated.tableId).toBeNull();
    expect(eventPublisher.events[1].eventType).toBe('TABLE_DEVICE_DISASSOCIATED');
  });

  it('retrieves active session for table device', async () => {
    const deviceRepo = new InMemoryTableDeviceRepo();
    const sessionRepo = new InMemorySessionRepo();

    const device = TableDevice.create({
      id: DEV_ID,
      restaurantId: REST_ID,
      name: 'Tablet 1',
      tableId: TABLE_1,
    }).value!;
    await deviceRepo.save(device);

    const session = TableSession.create({
      id: 'session-100',
      restaurantId: REST_ID,
      tableId: TABLE_1,
      initialWaiterId: 'waiter-1',
    }).value!;
    await sessionRepo.save(session);

    const getSessionUseCase = new GetTableDeviceSessionUseCase(deviceRepo, sessionRepo);
    const resolvedSession = await getSessionUseCase.execute(DEV_ID);

    expect(resolvedSession).not.toBeNull();
    expect(resolvedSession?.id).toBe('session-100');
  });

  it('lists devices for a restaurant and gets device by ID', async () => {
    const deviceRepo = new InMemoryTableDeviceRepo();

    const dev1 = TableDevice.create({ id: 'd1', restaurantId: REST_ID, name: 'T1' }).value!;
    const dev2 = TableDevice.create({ id: 'd2', restaurantId: REST_ID, name: 'T2' }).value!;
    const devOther = TableDevice.create({ id: 'd3', restaurantId: 'other-rest', name: 'T3' }).value!;
    await deviceRepo.save(dev1);
    await deviceRepo.save(dev2);
    await deviceRepo.save(devOther);

    const listUseCase = new ListTableDevicesUseCase(deviceRepo);
    const list = await listUseCase.execute(REST_ID);
    expect(list).toHaveLength(2);

    const getUseCase = new GetTableDeviceUseCase(deviceRepo);
    const fetched = await getUseCase.execute('d1');
    expect(fetched?.name).toBe('T1');
  });
});
