import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import {
  JwtService,
  setupAuth,
  requirePermission,
  Argon2PasswordHasher,
  prisma,
} from '@restaurant-os/infrastructure';
import { RoleBasedPermissionChecker, OperationalResourceScoper } from '@restaurant-os/application';
import { Permission, StaffRole } from '@restaurant-os/domain';
import { authRoutes } from '../src/routes/auth';

describe('Auth API Routes — Secure Authentication & Verification (Step 3.2)', () => {
  let app: FastifyInstance;
  const jwtService = new JwtService('test_api_jwt_secret_999');
  const credentialHasher = new Argon2PasswordHasher({
    memoryCost: 16384, // 16MB for faster test execution
    timeCost: 2,
    parallelism: 2,
  });

  const RESTAURANT_A = 'a0000000-0000-0000-0000-000000000001';
  const RESTAURANT_B = 'a0000000-0000-0000-0000-000000000002';
  const STAFF_ID = 'e0000000-0000-0000-0000-000000000001';
  const DEVICE_ID = '90000000-0000-0000-0000-000000000001';
  const TABLE_ID = 'b0000000-0000-0000-0000-000000000001';
  const SESSION_ID = 'c0000000-0000-0000-0000-000000000001';

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

    await app.register(authRoutes, { prefix: '/api/auth', jwtService, credentialHasher });

    // Protected dummy endpoint for testing role/permission enforcement
    app.get('/api/protected-admin', {
      preHandler: [requirePermission(Permission.STAFF_MANAGE)],
    }, async (request) => {
      return { ok: true, actorId: request.actor.id, type: request.actor.type };
    });

    await app.ready();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  describe('1. Staff Authentication (POST /api/auth/staff-login)', () => {
    it('1.1. Emits JWT when staff provides correct password', async () => {
      const password = 'CorrectPassword123!';
      const passwordHash = await credentialHasher.hash(password);

      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValueOnce({
        id: STAFF_ID,
        restaurantId: RESTAURANT_A,
        name: 'Carlos Gomez',
        email: 'carlos@restaurant.com',
        passwordHash,
        pinCodeHash: null,
        passwordUpdatedAt: new Date(),
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [{ id: 'role-1', staffId: STAFF_ID, role: 'ADMIN', createdAt: new Date() }],
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          email: 'carlos@restaurant.com',
          restaurantId: RESTAURANT_A,
          password,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBeDefined();
      expect(body.actor.id).toBe(STAFF_ID);
      expect(body.actor.type).toBe('STAFF');
      expect(body.actor.restaurantId).toBe(RESTAURANT_A);
      expect(body.actor.roles).toContain('ADMIN');

      const verified = jwtService.verify(body.token);
      expect(verified.success).toBe(true);
    });

    it('1.2. Returns 401 when staff provides incorrect password', async () => {
      const passwordHash = await credentialHasher.hash('RightPassword');

      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValueOnce({
        id: STAFF_ID,
        restaurantId: RESTAURANT_A,
        name: 'Carlos Gomez',
        email: 'carlos@restaurant.com',
        passwordHash,
        pinCodeHash: null,
        passwordUpdatedAt: new Date(),
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [],
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          email: 'carlos@restaurant.com',
          restaurantId: RESTAURANT_A,
          password: 'WrongPassword!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Invalid credentials');
    });

    it('1.3. Returns 401 when staff user does not exist', async () => {
      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          email: 'nonexistent@restaurant.com',
          restaurantId: RESTAURANT_A,
          password: 'AnyPassword123',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid credentials');
    });

    it('1.4. Returns 401 when staff user is inactive', async () => {
      const passwordHash = await credentialHasher.hash('AnyPassword123');

      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValueOnce({
        id: STAFF_ID,
        restaurantId: RESTAURANT_A,
        active: false,
        passwordHash,
        roles: [],
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          staffId: STAFF_ID,
          restaurantId: RESTAURANT_A,
          password: 'AnyPassword123',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid credentials');
    });

    it('1.5. Returns 401 when staff user has no passwordHash configured', async () => {
      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValueOnce({
        id: STAFF_ID,
        restaurantId: RESTAURANT_A,
        active: true,
        passwordHash: null,
        pinCodeHash: null,
        roles: [],
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          staffId: STAFF_ID,
          restaurantId: RESTAURANT_A,
          password: 'AnyPassword123',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid credentials');
    });

    it('1.6. Emits JWT when staff provides correct PIN', async () => {
      const pin = '4829';
      const pinCodeHash = await credentialHasher.hashPin(pin);

      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValueOnce({
        id: STAFF_ID,
        restaurantId: RESTAURANT_A,
        name: 'Mozo Juan',
        email: 'juan@restaurant.com',
        passwordHash: null,
        pinCodeHash,
        active: true,
        roles: [{ id: 'role-2', staffId: STAFF_ID, role: 'WAITER', createdAt: new Date() }],
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          staffId: STAFF_ID,
          restaurantId: RESTAURANT_A,
          pin,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBeDefined();
      expect(body.actor.roles).toContain('WAITER');
    });

    it('1.7. Returns 401 when staff provides incorrect PIN', async () => {
      const pinCodeHash = await credentialHasher.hashPin('4829');

      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValueOnce({
        id: STAFF_ID,
        restaurantId: RESTAURANT_A,
        active: true,
        pinCodeHash,
        roles: [],
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          staffId: STAFF_ID,
          restaurantId: RESTAURANT_A,
          pin: '0000',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid credentials');
    });

    it('1.8. Denies login when only staffId is provided without credential', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          staffId: STAFF_ID,
          restaurantId: RESTAURANT_A,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('Invalid input');
    });

    it('1.9. Denies login when only email is provided without credential', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          email: 'admin@restaurant.com',
          restaurantId: RESTAURANT_A,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('Invalid input');
    });
  });

  describe('2. TableDevice Authentication (POST /api/auth/device-auth)', () => {
    it('2.1. Emits JWT when device provides valid deviceSecret', async () => {
      const deviceSecret = 'device-secret-hardware-tablet-01';
      const deviceSecretHash = await credentialHasher.hashDeviceSecret(deviceSecret);

      vi.spyOn(prisma.tableDevice, 'findFirst').mockResolvedValueOnce({
        id: DEVICE_ID,
        restaurantId: RESTAURANT_A,
        tableId: TABLE_ID,
        name: 'Tablet Mesa 1',
        deviceSecretHash,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/device-auth',
        payload: {
          deviceId: DEVICE_ID,
          restaurantId: RESTAURANT_A,
          deviceSecret,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBeDefined();
      expect(body.actor.id).toBe(DEVICE_ID);
      expect(body.actor.type).toBe('TABLE_DEVICE');
      expect(body.actor.restaurantId).toBe(RESTAURANT_A);
    });

    it('2.2. Returns 401 when device provides incorrect deviceSecret', async () => {
      const deviceSecretHash = await credentialHasher.hashDeviceSecret('RightDeviceSecret');

      vi.spyOn(prisma.tableDevice, 'findFirst').mockResolvedValueOnce({
        id: DEVICE_ID,
        restaurantId: RESTAURANT_A,
        deviceSecretHash,
        active: true,
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/device-auth',
        payload: {
          deviceId: DEVICE_ID,
          restaurantId: RESTAURANT_A,
          deviceSecret: 'WrongDeviceSecret',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid device credentials');
    });

    it('2.3. Returns 401 when device does not exist', async () => {
      vi.spyOn(prisma.tableDevice, 'findFirst').mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/device-auth',
        payload: {
          deviceId: DEVICE_ID,
          restaurantId: RESTAURANT_A,
          deviceSecret: 'SomeSecret',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid device credentials');
    });

    it('2.4. Returns 401 when device is inactive', async () => {
      const deviceSecretHash = await credentialHasher.hashDeviceSecret('SomeSecret');

      vi.spyOn(prisma.tableDevice, 'findFirst').mockResolvedValueOnce({
        id: DEVICE_ID,
        restaurantId: RESTAURANT_A,
        deviceSecretHash,
        active: false,
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/device-auth',
        payload: {
          deviceId: DEVICE_ID,
          restaurantId: RESTAURANT_A,
          deviceSecret: 'SomeSecret',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid device credentials');
    });

    it('2.5. Returns 401 when device has no deviceSecretHash configured', async () => {
      vi.spyOn(prisma.tableDevice, 'findFirst').mockResolvedValueOnce({
        id: DEVICE_ID,
        restaurantId: RESTAURANT_A,
        deviceSecretHash: null,
        active: true,
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/device-auth',
        payload: {
          deviceId: DEVICE_ID,
          restaurantId: RESTAURANT_A,
          deviceSecret: 'SomeSecret',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid device credentials');
    });

    it('2.6. Denies authentication when deviceSecret is missing in payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/device-auth',
        payload: {
          deviceId: DEVICE_ID,
          restaurantId: RESTAURANT_A,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('Invalid input');
    });
  });

  describe('3. Customer Session Authentication & Safety', () => {
    it('3.1. Issues token for customer and validates active tableSession', async () => {
      vi.spyOn(prisma.tableSession, 'findFirst').mockResolvedValueOnce({
        id: SESSION_ID,
        restaurantId: RESTAURANT_A,
        tableId: TABLE_ID,
        status: 'OCCUPIED',
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/customer-session-token',
        payload: {
          restaurantId: RESTAURANT_A,
          tableSessionId: SESSION_ID,
          name: 'Comensal Mesa 1',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBeDefined();
      expect(body.actor.type).toBe('CUSTOMER');
      expect(body.actor.restaurantId).toBe(RESTAURANT_A);
    });

    it('3.2. Rejects customer session token if tableSession does not exist or is closed', async () => {
      vi.spyOn(prisma.tableSession, 'findFirst').mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/customer-session-token',
        payload: {
          restaurantId: RESTAURANT_A,
          tableSessionId: SESSION_ID,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toContain('Invalid or closed table session');
    });
  });

  describe('4. JWT Lifecycle & Actor Identity Verification', () => {
    it('4.1. Resolves actor identity correctly via GET /api/auth/me', async () => {
      const token = jwtService.sign({
        sub: STAFF_ID,
        type: 'STAFF',
        restaurantId: RESTAURANT_A,
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
      expect(body.actor.id).toBe(STAFF_ID);
      expect(body.actor.type).toBe('STAFF');
      expect(body.actor.restaurantId).toBe(RESTAURANT_A);
    });

    it('4.2. Rejects tampered / manipulated JWT', async () => {
      const token = jwtService.sign({
        sub: STAFF_ID,
        type: 'STAFF',
        restaurantId: RESTAURANT_A,
      });

      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${tamperedToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('4.3. Rejects expired JWT', async () => {
      const expiredToken = jwtService.sign(
        {
          sub: STAFF_ID,
          type: 'STAFF',
          restaurantId: RESTAURANT_A,
        },
        -10, // expired 10 seconds ago
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid or expired token');
    });
  });

  describe('5. Cross-Tenant & Actor Isolation', () => {
    it('5.1. Staff of Restaurant A cannot authenticate against Restaurant B', async () => {
      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          email: 'staff@restaurantA.com',
          restaurantId: RESTAURANT_B,
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid credentials');
    });

    it('5.2. Device of Restaurant A cannot authenticate against Restaurant B', async () => {
      vi.spyOn(prisma.tableDevice, 'findFirst').mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/device-auth',
        payload: {
          deviceId: DEVICE_ID,
          restaurantId: RESTAURANT_B,
          deviceSecret: 'Secret123',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('Invalid device credentials');
    });

    it('5.3. Customer cannot gain STAFF access to protected endpoints', async () => {
      const customerToken = jwtService.sign({
        sub: 'cust-123',
        type: 'CUSTOMER',
        restaurantId: RESTAURANT_A,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/protected-admin',
        headers: {
          authorization: `Bearer ${customerToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('5.4. TableDevice cannot gain STAFF access to protected endpoints', async () => {
      const deviceToken = jwtService.sign({
        sub: DEVICE_ID,
        type: 'TABLE_DEVICE',
        restaurantId: RESTAURANT_A,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/protected-admin',
        headers: {
          authorization: `Bearer ${deviceToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('6. Critical Vulnerability Regression Test (Pre-flight Flaw Reproduction)', () => {
    it('6.1. BEFORE: staffId + restaurantId alone produced a JWT. AFTER: It is STRICTLY DENIED (400 validation error)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/staff-login',
        payload: {
          staffId: STAFF_ID,
          restaurantId: RESTAURANT_A,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Invalid input');
      expect(body.token).toBeUndefined();
    });

    it('6.2. BEFORE: deviceId + restaurantId alone produced a JWT. AFTER: It is STRICTLY DENIED (400 validation error)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/device-auth',
        payload: {
          deviceId: DEVICE_ID,
          restaurantId: RESTAURANT_A,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Invalid input');
      expect(body.token).toBeUndefined();
    });
  });
});
