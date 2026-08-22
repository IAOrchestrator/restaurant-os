import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { JwtService, setupAuth, requirePermission } from '@restaurant-os/infrastructure';
import { RoleBasedPermissionChecker, OperationalResourceScoper } from '@restaurant-os/application';
import { Permission, StaffRole } from '@restaurant-os/domain';
import { authRoutes } from '../src/routes/auth';

describe('Auth API Routes & JWT Verification', () => {
  let app: FastifyInstance;
  const jwtService = new JwtService('test_api_jwt_secret_999');
  const RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    app = fastify();

    const permissionChecker = new RoleBasedPermissionChecker(async () => [StaffRole.ADMIN]);
    const resourceScoper = new OperationalResourceScoper(
      async () => [],
      async () => null,
      async () => [StaffRole.ADMIN],
    );

    setupAuth(app, {
      permissionChecker,
      resourceScoper,
      jwtService,
    });

    await app.register(authRoutes, { prefix: '/api/auth', jwtService });

    // Protected dummy endpoint
    app.get('/api/protected-admin', {
      preHandler: [requirePermission(Permission.STAFF_MANAGE)],
    }, async (request) => {
      return { ok: true, actorId: request.actor.id, type: request.actor.type };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a Customer session token via POST /api/auth/customer-session-token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/customer-session-token',
      payload: {
        restaurantId: RESTAURANT_ID,
        name: 'Invitado VIP',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.actor.type).toBe('CUSTOMER');
    expect(body.actor.restaurantId).toBe(RESTAURANT_ID);

    // Verify token validity
    const verified = jwtService.verify(body.token);
    expect(verified.success).toBe(true);
  });

  it('resolves actor identity via GET /api/auth/me using Bearer token', async () => {
    const token = jwtService.sign({
      sub: 'waiter-777',
      type: 'STAFF',
      restaurantId: RESTAURANT_ID,
      roles: [StaffRole.WAITER],
      name: 'Lucas Benitez',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.actor.id).toBe('waiter-777');
    expect(body.actor.type).toBe('STAFF');
    expect(body.actor.restaurantId).toBe(RESTAURANT_ID);
    expect(body.tokenPayload.name).toBe('Lucas Benitez');
  });

  it('allows access to protected endpoint with valid Staff token', async () => {
    const token = jwtService.sign({
      sub: 'admin-001',
      type: 'STAFF',
      restaurantId: RESTAURANT_ID,
      roles: [StaffRole.ADMIN],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/protected-admin',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.actorId).toBe('admin-001');
  });

  it('rejects access to protected endpoint when token is invalid or missing permissions', async () => {
    // Customer token without STAFF_MANAGE permission
    const token = jwtService.sign({
      sub: 'cust-999',
      type: 'CUSTOMER',
      restaurantId: RESTAURANT_ID,
      tableSessionId: null,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/protected-admin',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
