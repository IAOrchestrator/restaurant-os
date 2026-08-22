import { describe, it, expect } from 'vitest';
import {
  RoleBasedPermissionChecker,
  OperationalResourceScoper,
  type EventPublisher,
} from '../src';
import { Actor, Permission, StaffRole, ResourceScopeType } from '@restaurant-os/domain';

class StubEventPublisher implements EventPublisher {
  public events: { eventType: string; payload: Record<string, unknown> }[] = [];
  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.events.push({ eventType, payload });
  }
}

describe('Application layer — Auth & Scoping', () => {
  it('StubEventPublisher captures published events', async () => {
    const publisher = new StubEventPublisher();
    await publisher.publish('TEST_EVENT', { foo: 'bar' });
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0].eventType).toBe('TEST_EVENT');
  });

  describe('RoleBasedPermissionChecker', () => {
    it('allows System actor all permissions', async () => {
      const checker = new RoleBasedPermissionChecker(async () => []);
      const systemActor = Actor.system();
      const hasPerm = await checker.hasPermission(systemActor, Permission.RESTAURANT_MANAGE);
      expect(hasPerm).toBe(true);
    });

    it('allows Customer customer-specific permissions only', async () => {
      const checker = new RoleBasedPermissionChecker(async () => []);
      const customerActor = Actor.customer('cust-1', 'rest-1');

      expect(await checker.hasPermission(customerActor, Permission.PREORDERS_CREATE)).toBe(true);
      expect(await checker.hasPermission(customerActor, Permission.RESTAURANT_MANAGE)).toBe(false);
      expect(await checker.hasPermission(customerActor, Permission.TABLES_ASSIGN)).toBe(false);
    });

    it('resolves Staff permissions based on assigned roles', async () => {
      const checker = new RoleBasedPermissionChecker(async (staffId: string) => {
        if (staffId === 'waiter-1') return [StaffRole.WAITER];
        if (staffId === 'admin-1') return [StaffRole.ADMIN];
        return [];
      });

      const waiter = Actor.staff('waiter-1', 'rest-1');
      const admin = Actor.staff('admin-1', 'rest-1');

      expect(await checker.hasPermission(waiter, Permission.ORDERS_CREATE)).toBe(true);
      expect(await checker.hasPermission(waiter, Permission.RESTAURANT_MANAGE)).toBe(false);
      expect(await checker.hasPermission(admin, Permission.RESTAURANT_MANAGE)).toBe(true);
    });
  });

  describe('OperationalResourceScoper', () => {
    it('returns global scope for System', async () => {
      const scoper = new OperationalResourceScoper(async () => []);
      const scope = await scoper.getScope(Actor.system(), 'order');
      expect(scope.isGlobal()).toBe(true);
    });

    it('returns own scope for Customer', async () => {
      const scoper = new OperationalResourceScoper(async () => []);
      const scope = await scoper.getScope(Actor.customer('c-1', 'rest-1'), 'order');
      expect(scope.isOwn()).toBe(true);
    });

    it('returns scoped session IDs for Waiter', async () => {
      const scoper = new OperationalResourceScoper(async (waiterId: string) => ['session-101', 'session-102']);
      const scope = await scoper.getScope(Actor.staff('w-1', 'rest-1'), 'table-session');

      expect(scope.isOwn()).toBe(true);
      expect(scope.canAccess('session-101')).toBe(true);
      expect(scope.canAccess('session-999')).toBe(false);
    });

    it('returns own scope with active session for TableDevice', async () => {
      const scoper = new OperationalResourceScoper(
        async () => [],
        async (deviceId: string) => (deviceId === 'dev-1' ? 'session-200' : null),
      );
      const scope = await scoper.getScope(Actor.tableDevice('dev-1', 'rest-1'), 'order');

      expect(scope.isOwn()).toBe(true);
      expect(scope.canAccess('session-200')).toBe(true);
      expect(scope.canAccess('session-300')).toBe(false);
    });
  });
});
