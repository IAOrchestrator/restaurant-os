import { describe, it, expect } from 'vitest';
import fastify from 'fastify';
import {
  setupAuth,
  requirePermission,
  requireAnyPermission,
  validateRestaurantAccess,
  requireResourceAccess,
  extractActor,
} from '../src/auth/fastify-auth';
import { Actor, Permission, StaffRole } from '@restaurant-os/domain';
import { RoleBasedPermissionChecker, OperationalResourceScoper } from '@restaurant-os/application';

describe('Infrastructure Auth & Authorization', () => {
  describe('extractActor', () => {
    it('extracts CUSTOMER actor from headers', () => {
      const actor = extractActor({
        'x-actor-type': 'CUSTOMER',
        'x-actor-id': 'cust-123',
        'x-restaurant-id': 'rest-1',
      });
      expect(actor.isCustomer()).toBe(true);
      expect(actor.id).toBe('cust-123');
      expect(actor.restaurantId).toBe('rest-1');
    });

    it('extracts STAFF actor from headers', () => {
      const actor = extractActor({
        'x-actor-type': 'STAFF',
        'x-actor-id': 'staff-456',
        'x-restaurant-id': 'rest-1',
      });
      expect(actor.isStaff()).toBe(true);
      expect(actor.id).toBe('staff-456');
    });

    it('extracts TABLE_DEVICE actor from headers', () => {
      const actor = extractActor({
        'x-actor-type': 'TABLE_DEVICE',
        'x-actor-id': 'device-789',
        'x-restaurant-id': 'rest-1',
      });
      expect(actor.isTableDevice()).toBe(true);
      expect(actor.id).toBe('device-789');
    });

    it('extracts SYSTEM actor from headers', () => {
      const actor = extractActor({
        'x-actor-type': 'SYSTEM',
      });
      expect(actor.isSystem()).toBe(true);
    });

    it('defaults to anonymous CUSTOMER when headers are missing', () => {
      const actor = extractActor({});
      expect(actor.isCustomer()).toBe(true);
      expect(actor.id).toBe('anonymous');
    });
  });

  describe('Fastify Auth Hooks & PreHandlers', () => {
    const buildTestApp = () => {
      const app = fastify();
      const permissionChecker = new RoleBasedPermissionChecker(async (staffId: string) => {
        if (staffId === 'admin-1') return [StaffRole.ADMIN];
        if (staffId === 'waiter-1') return [StaffRole.WAITER];
        return [];
      });

      const resourceScoper = new OperationalResourceScoper(
        async (waiterId: string) => (waiterId === 'waiter-1' ? ['session-allowed'] : []),
        async (deviceId: string) => (deviceId === 'device-1' ? 'session-allowed' : null),
      );

      setupAuth(app, {
        permissionChecker,
        resourceScoper,
      });

      // Protected routes for testing
      app.get(
        '/admin-only',
        { preHandler: requirePermission(Permission.RESTAURANT_MANAGE) },
        async () => ({ ok: true }),
      );

      app.get(
        '/preorders-allowed',
        { preHandler: requirePermission(Permission.PREORDERS_CREATE) },
        async () => ({ ok: true }),
      );

      app.post(
        '/tenant-check',
        { preHandler: validateRestaurantAccess() },
        async (req) => ({ body: req.body }),
      );

      app.get(
        '/tenant-check-query',
        { preHandler: validateRestaurantAccess() },
        async (req) => ({ query: req.query }),
      );

      app.get(
        '/scoped-session/:id',
        { preHandler: requireResourceAccess('table-session') },
        async (req) => ({ id: (req.params as any).id }),
      );

      return app;
    };

    it('returns 403 when actor lacks required permission', async () => {
      const app = buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin-only',
        headers: {
          'x-actor-type': 'CUSTOMER',
          'x-actor-id': 'cust-1',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Forbidden');
    });

    it('returns 200 when actor has required permission', async () => {
      const app = buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/admin-only',
        headers: {
          'x-actor-type': 'STAFF',
          'x-actor-id': 'admin-1',
          'x-restaurant-id': 'rest-1',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ ok: true });
    });

    it('allows customer on customer-permitted routes', async () => {
      const app = buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/preorders-allowed',
        headers: {
          'x-actor-type': 'CUSTOMER',
          'x-actor-id': 'cust-1',
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('blocks cross-restaurant mismatch in request body with 403', async () => {
      const app = buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/tenant-check',
        headers: {
          'x-actor-type': 'STAFF',
          'x-actor-id': 'waiter-1',
          'x-restaurant-id': 'restaurant-AAA',
        },
        payload: {
          restaurantId: 'restaurant-BBB',
          data: 'test',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('Access denied to other restaurant data');
    });

    it('blocks cross-restaurant mismatch in query string with 403', async () => {
      const app = buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/tenant-check-query?restaurantId=restaurant-OTHER',
        headers: {
          'x-actor-type': 'STAFF',
          'x-actor-id': 'waiter-1',
          'x-restaurant-id': 'restaurant-MAIN',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('allows matching restaurant access', async () => {
      const app = buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/tenant-check',
        headers: {
          'x-actor-type': 'STAFF',
          'x-actor-id': 'waiter-1',
          'x-restaurant-id': 'restaurant-AAA',
        },
        payload: {
          restaurantId: 'restaurant-AAA',
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('enforces resource scoping for waiter', async () => {
      const app = buildTestApp();

      // Access allowed session
      const resAllowed = await app.inject({
        method: 'GET',
        url: '/scoped-session/session-allowed',
        headers: {
          'x-actor-type': 'STAFF',
          'x-actor-id': 'waiter-1',
          'x-restaurant-id': 'rest-1',
        },
      });
      expect(resAllowed.statusCode).toBe(200);

      // Access disallowed session
      const resDenied = await app.inject({
        method: 'GET',
        url: '/scoped-session/session-forbidden',
        headers: {
          'x-actor-type': 'STAFF',
          'x-actor-id': 'waiter-1',
          'x-restaurant-id': 'rest-1',
        },
      });
      expect(resDenied.statusCode).toBe(403);
    });
  });
});
