import { describe, it, expect } from 'vitest';
import { StaffRole, ROLE_PERMISSIONS, Permission } from '../src/auth';

describe('ROLE_PERMISSIONS', () => {
  it('should give ADMIN all permissions', () => {
    const adminPerms = ROLE_PERMISSIONS[StaffRole.ADMIN];
    expect(adminPerms).toContain(Permission.RESTAURANT_MANAGE);
    expect(adminPerms).toContain(Permission.ORDERS_CREATE);
    expect(adminPerms).toContain(Permission.KITCHEN_ORDERS_START);
  });

  it('should give WAITER order and service permissions', () => {
    const waiterPerms = ROLE_PERMISSIONS[StaffRole.WAITER];
    expect(waiterPerms).toContain(Permission.ORDERS_CREATE);
    expect(waiterPerms).toContain(Permission.ORDERS_SEND_TO_KITCHEN);
    expect(waiterPerms).not.toContain(Permission.KITCHEN_ORDERS_START);
    expect(waiterPerms).not.toContain(Permission.PAYMENTS_REGISTER);
  });

  it('should give KITCHEN only kitchen permissions', () => {
    const kitchenPerms = ROLE_PERMISSIONS[StaffRole.KITCHEN];
    expect(kitchenPerms).toContain(Permission.KITCHEN_ORDERS_START);
    expect(kitchenPerms).toContain(Permission.KITCHEN_ORDERS_READY);
    expect(kitchenPerms).not.toContain(Permission.ORDERS_CREATE);
    expect(kitchenPerms).not.toContain(Permission.ACCOUNTS_READ);
  });

  it('should give CASHIER billing permissions', () => {
    const cashierPerms = ROLE_PERMISSIONS[StaffRole.CASHIER];
    expect(cashierPerms).toContain(Permission.PAYMENTS_REGISTER);
    expect(cashierPerms).toContain(Permission.ACCOUNTS_READ);
    expect(cashierPerms).not.toContain(Permission.ORDERS_CREATE);
  });

  it('should give RECEPTIONIST waitlist and table permissions', () => {
    const receptionPerms = ROLE_PERMISSIONS[StaffRole.RECEPTIONIST];
    expect(receptionPerms).toContain(Permission.WAITLIST_MANAGE);
    expect(receptionPerms).toContain(Permission.TABLES_ASSIGN);
    expect(receptionPerms).not.toContain(Permission.ORDERS_CREATE);
  });
});
