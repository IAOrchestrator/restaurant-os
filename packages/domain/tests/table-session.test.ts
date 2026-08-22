import { describe, it, expect } from 'vitest';
import {
  TableSession,
  TableSessionStatus,
} from '../src/table-session/entity';

describe('TableSession aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    restaurantId: '550e8400-e29b-41d4-a716-446655440001',
    tableId: '550e8400-e29b-41d4-a716-446655440002',
    initialWaiterId: '550e8400-e29b-41d4-a716-446655440003',
  };

  it('creates with ASSIGNED status and initial waiter and table', () => {
    const result = TableSession.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(TableSessionStatus.ASSIGNED);
      expect(result.value.tableId).toBe(validProps.tableId);
      expect(result.value.currentWaiterId).toBe(validProps.initialWaiterId);
      expect(result.value.waiterAssignments).toHaveLength(1);
      expect(result.value.tableHistory).toHaveLength(1);
      expect(result.value.customerIds).toHaveLength(0);
    }
  });

  it('transitions ASSIGNED → OCCUPIED', () => {
    const session = TableSession.create(validProps).value!;
    const occupied = session.occupy();
    expect(occupied.success).toBe(true);
    if (occupied.success) {
      expect(occupied.value.status).toBe(TableSessionStatus.OCCUPIED);
    }
  });

  it('transitions OCCUPIED → OPEN', () => {
    const session = TableSession.create(validProps).value!.occupy().value!;
    const opened = session.open();
    expect(opened.success).toBe(true);
    if (opened.success) {
      expect(opened.value.status).toBe(TableSessionStatus.OPEN);
    }
  });

  it('transitions OPEN → CLOSING', () => {
    const session = TableSession.create(validProps).value!.occupy().value!.open().value!;
    const closing = session.requestClose();
    expect(closing.success).toBe(true);
    if (closing.success) {
      expect(closing.value.status).toBe(TableSessionStatus.CLOSING);
    }
  });

  it('transitions CLOSING → CLOSED', () => {
    const session = TableSession.create(validProps)
      .value!.occupy().value!.open().value!.requestClose().value!;
    const closed = session.close();
    expect(closed.success).toBe(true);
    if (closed.success) {
      expect(closed.value.status).toBe(TableSessionStatus.CLOSED);
      expect(closed.value.closedAt).not.toBeNull();
    }
  });

  it('fails invalid transitions', () => {
    const session = TableSession.create(validProps).value!;
    expect(session.open().success).toBe(false);
    expect(session.requestClose().success).toBe(false);
    expect(session.close().success).toBe(false);
  });

  it('changes waiter and preserves history', () => {
    const session = TableSession.create(validProps).value!;
    const newWaiterId = '550e8400-e29b-41d4-a716-446655440004';
    const changed = session.changeWaiter(newWaiterId);
    expect(changed.success).toBe(true);
    if (changed.success) {
      expect(changed.value.currentWaiterId).toBe(newWaiterId);
      expect(changed.value.waiterAssignments).toHaveLength(2);
      expect(changed.value.waiterAssignments[0].replacedAt).toBeDefined();
      expect(changed.value.waiterAssignments[1].waiterId).toBe(newWaiterId);
    }
  });

  it('fails to change waiter when CLOSED', () => {
    const session = TableSession.create(validProps)
      .value!.occupy().value!.open().value!.requestClose().value!.close().value!;
    const changed = session.changeWaiter('new-waiter');
    expect(changed.success).toBe(false);
  });

  it('changes table and preserves table history', () => {
    const session = TableSession.create(validProps).value!;
    const newTableId = '550e8400-e29b-41d4-a716-446655440099';
    const changed = session.changeTable(newTableId);
    expect(changed.success).toBe(true);
    if (changed.success) {
      expect(changed.value.tableId).toBe(newTableId);
      expect(changed.value.tableHistory).toHaveLength(2);
      expect(changed.value.tableHistory[0].releasedAt).toBeDefined();
      expect(changed.value.tableHistory[1].tableId).toBe(newTableId);
    }
  });

  it('fails to change table to the current table or when CLOSED', () => {
    const session = TableSession.create(validProps).value!;
    expect(session.changeTable(validProps.tableId).success).toBe(false);

    const closed = session.occupy().value!.open().value!.requestClose().value!.close().value!;
    expect(closed.changeTable('any-table').success).toBe(false);
  });

  it('adds and removes customers', () => {
    const session = TableSession.create(validProps).value!;
    const cust1 = '550e8400-e29b-41d4-a716-446655440010';
    const cust2 = '550e8400-e29b-41d4-a716-446655440020';

    const withCust1 = session.addCustomer(cust1);
    expect(withCust1.success).toBe(true);
    expect(withCust1.value?.customerIds).toEqual([cust1]);

    const withCust2 = withCust1.value!.addCustomer(cust2);
    expect(withCust2.success).toBe(true);
    expect(withCust2.value?.customerIds).toEqual([cust1, cust2]);

    // Re-adding same customer fails
    expect(withCust2.value!.addCustomer(cust1).success).toBe(false);

    // Remove customer
    const removedCust1 = withCust2.value!.removeCustomer(cust1);
    expect(removedCust1.success).toBe(true);
    expect(removedCust1.value?.customerIds).toEqual([cust2]);

    // Removing non-existent customer fails
    expect(removedCust1.value!.removeCustomer('unknown-cust').success).toBe(false);
  });

  it('is immutable', () => {
    const session = TableSession.create(validProps).value!;
    session.occupy();
    expect(session.status).toBe(TableSessionStatus.ASSIGNED);
  });
});
