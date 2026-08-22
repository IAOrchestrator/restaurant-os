import { describe, it, expect } from 'vitest';
import { Permission, ALL_PERMISSIONS } from '../src/auth';

describe('Permission', () => {
  it('should have all expected permissions', () => {
    expect(ALL_PERMISSIONS).toContain(Permission.ORDERS_READ);
    expect(ALL_PERMISSIONS).toContain(Permission.ORDERS_CREATE);
    expect(ALL_PERMISSIONS).toContain(Permission.KITCHEN_ORDERS_START);
    expect(ALL_PERMISSIONS).toContain(Permission.ACCOUNTS_READ);
    expect(ALL_PERMISSIONS).toContain(Permission.RESTAURANT_MANAGE);
  });

  it('should have consistent naming convention', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(perm).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('should have at least 30 permissions', () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(30);
  });
});
