import { describe, it, expect } from 'vitest';
import { TableDevice, TableDeviceDomainError } from '../src/table-device';

describe('TableDevice Aggregate', () => {
  const REST_ID = 'rest-1';
  const DEV_ID = 'dev-1';
  const TABLE_ID = 'table-1';

  it('creates a valid table device without table assignment', () => {
    const result = TableDevice.create({
      id: DEV_ID,
      restaurantId: REST_ID,
      name: 'Tablet Table 1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.id).toBe(DEV_ID);
      expect(result.value.restaurantId).toBe(REST_ID);
      expect(result.value.name).toBe('Tablet Table 1');
      expect(result.value.tableId).toBeNull();
      expect(result.value.active).toBe(true);
      expect(result.value.createdAt).toBeInstanceOf(Date);
      expect(result.value.updatedAt).toBeInstanceOf(Date);
    }
  });

  it('creates a valid table device with table assignment', () => {
    const result = TableDevice.create({
      id: DEV_ID,
      restaurantId: REST_ID,
      name: 'Tablet Table 1',
      tableId: TABLE_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.tableId).toBe(TABLE_ID);
    }
  });

  it('validates required fields on create', () => {
    const noId = TableDevice.create({ id: '', restaurantId: REST_ID, name: 'Tablet 1' });
    expect(noId.success).toBe(false);
    expect(noId.error).toBeInstanceOf(TableDeviceDomainError);

    const noRest = TableDevice.create({ id: DEV_ID, restaurantId: '', name: 'Tablet 1' });
    expect(noRest.success).toBe(false);

    const noName = TableDevice.create({ id: DEV_ID, restaurantId: REST_ID, name: '' });
    expect(noName.success).toBe(false);
  });

  it('associates and disassociates a table', () => {
    const device = TableDevice.create({
      id: DEV_ID,
      restaurantId: REST_ID,
      name: 'Tablet 1',
    }).value!;

    expect(device.tableId).toBeNull();

    // Associate
    const assocResult = device.associateTable(TABLE_ID);
    expect(assocResult.success).toBe(true);
    expect(device.tableId).toBe(TABLE_ID);

    // Disassociate
    const disassocResult = device.disassociateTable();
    expect(disassocResult.success).toBe(true);
    expect(device.tableId).toBeNull();
  });

  it('updates name and activation state', () => {
    const device = TableDevice.create({
      id: DEV_ID,
      restaurantId: REST_ID,
      name: 'Tablet Old',
    }).value!;

    const nameRes = device.updateName('Tablet New');
    expect(nameRes.success).toBe(true);
    expect(device.name).toBe('Tablet New');

    device.deactivate();
    expect(device.active).toBe(false);

    device.activate();
    expect(device.active).toBe(true);
  });
});
