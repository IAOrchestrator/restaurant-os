import { describe, it, expect } from 'vitest';
import { Table, TableStatus, TableDomainError } from '../src/table/entity';

describe('Table aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    restaurantId: '550e8400-e29b-41d4-a716-446655440001',
    number: 5,
    capacity: 4,
  };

  it('creates with AVAILABLE status by default', () => {
    const result = Table.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(TableStatus.AVAILABLE);
      expect(result.value.number).toBe(5);
      expect(result.value.capacity).toBe(4);
    }
  });

  it('fails to create with non-positive number', () => {
    const result = Table.create({ ...validProps, number: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TableDomainError);
    }
  });

  it('fails to create with non-positive capacity', () => {
    const result = Table.create({ ...validProps, capacity: -1 });
    expect(result.success).toBe(false);
  });

  it('transitions AVAILABLE → ASSIGNED', () => {
    const table = Table.create(validProps).value!;
    const assigned = table.assign();
    expect(assigned.success).toBe(true);
    if (assigned.success) {
      expect(assigned.value.status).toBe(TableStatus.ASSIGNED);
    }
  });

  it('fails to assign if not AVAILABLE', () => {
    const table = Table.create(validProps).value!.assign().value!;
    const secondAssign = table.assign();
    expect(secondAssign.success).toBe(false);
  });

  it('transitions ASSIGNED → OCCUPIED or AVAILABLE → OCCUPIED', () => {
    const table = Table.create(validProps).value!.assign().value!;
    const occupied = table.occupy();
    expect(occupied.success).toBe(true);
    if (occupied.success) {
      expect(occupied.value.status).toBe(TableStatus.OCCUPIED);
    }
  });

  it('fails to occupy if already OCCUPIED', () => {
    const table = Table.create(validProps).value!.occupy().value!;
    const secondOccupy = table.occupy();
    expect(secondOccupy.success).toBe(false);
  });

  it('transitions OCCUPIED → AVAILABLE (release)', () => {
    const table = Table.create(validProps).value!.assign().value!.occupy().value!;
    const released = table.release();
    expect(released.success).toBe(true);
    if (released.success) {
      expect(released.value.status).toBe(TableStatus.AVAILABLE);
    }
  });

  it('fails to release if not OCCUPIED', () => {
    const table = Table.create(validProps).value!;
    const released = table.release();
    expect(released.success).toBe(false);
  });

  it('is immutable: original table does not change on transition', () => {
    const table = Table.create(validProps).value!;
    table.assign();
    expect(table.status).toBe(TableStatus.AVAILABLE);
  });
});
