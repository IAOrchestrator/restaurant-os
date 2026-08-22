import { describe, it, expect } from 'vitest';
import {
  WORKSPACES_REGISTRY,
  isWorkspaceAllowed,
  getAllowedWorkspaces,
} from './registry';

describe('Workspaces Registry & Access Control', () => {
  it('registers all 8 operational workspaces', () => {
    const registeredKeys = Object.keys(WORKSPACES_REGISTRY);
    expect(registeredKeys).toEqual(
      expect.arrayContaining(['dashboard', 'reception', 'waiter', 'kitchen', 'table', 'customer', 'cashier', 'admin']),
    );
    expect(registeredKeys).toHaveLength(8);
  });

  it('allows CUSTOMER only on customer workspace', () => {
    expect(isWorkspaceAllowed('customer', 'CUSTOMER')).toBe(true);
    expect(isWorkspaceAllowed('admin', 'CUSTOMER')).toBe(false);
    expect(isWorkspaceAllowed('kitchen', 'CUSTOMER')).toBe(false);
    expect(isWorkspaceAllowed('cashier', 'CUSTOMER')).toBe(false);
    expect(isWorkspaceAllowed('waiter', 'CUSTOMER')).toBe(false);
  });

  it('allows TABLE_DEVICE only on table workspace', () => {
    expect(isWorkspaceAllowed('table', 'TABLE_DEVICE')).toBe(true);
    expect(isWorkspaceAllowed('admin', 'TABLE_DEVICE')).toBe(false);
    expect(isWorkspaceAllowed('kitchen', 'TABLE_DEVICE')).toBe(false);
  });

  it('allows WAITER on waiter and reception workspaces', () => {
    expect(isWorkspaceAllowed('waiter', 'STAFF', 'WAITER')).toBe(true);
    expect(isWorkspaceAllowed('reception', 'STAFF', 'WAITER')).toBe(false); // Waiter alone cannot do host duties unless assigned
    expect(isWorkspaceAllowed('kitchen', 'STAFF', 'WAITER')).toBe(false);
    expect(isWorkspaceAllowed('admin', 'STAFF', 'WAITER')).toBe(false);
  });

  it('allows KITCHEN staff only on kitchen workspace', () => {
    expect(isWorkspaceAllowed('kitchen', 'STAFF', 'KITCHEN')).toBe(true);
    expect(isWorkspaceAllowed('cashier', 'STAFF', 'KITCHEN')).toBe(false);
    expect(isWorkspaceAllowed('admin', 'STAFF', 'KITCHEN')).toBe(false);
  });

  it('allows CASHIER staff on cashier workspace', () => {
    expect(isWorkspaceAllowed('cashier', 'STAFF', 'CASHIER')).toBe(true);
    expect(isWorkspaceAllowed('kitchen', 'STAFF', 'CASHIER')).toBe(false);
  });

  it('allows ADMIN on all staff workspaces', () => {
    const adminWorkspaces = getAllowedWorkspaces('STAFF', 'ADMIN');
    expect(adminWorkspaces.map((w) => w.id)).toEqual(
      expect.arrayContaining(['reception', 'waiter', 'kitchen', 'cashier', 'admin']),
    );
  });
});
