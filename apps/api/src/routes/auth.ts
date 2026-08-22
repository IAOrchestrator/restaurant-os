import { FastifyInstance } from 'fastify';
import { prisma, JwtService } from '@restaurant-os/infrastructure';
import {
  StaffLoginSchema,
  TableDeviceAuthSchema,
  CustomerSessionAuthSchema,
} from '@restaurant-os/contracts';
import { StaffRole } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';

export interface AuthRoutesOptions {
  jwtService?: JwtService;
}

export async function authRoutes(app: FastifyInstance, opts: AuthRoutesOptions) {
  const jwt = opts.jwtService || new JwtService();

  // POST /api/auth/staff-login
  app.post('/staff-login', async (request, reply) => {
    const parse = StaffLoginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parse.error.format() });
    }

    const { staffId, email, restaurantId } = parse.data;

    const staff = await prisma.staff.findFirst({
      where: {
        restaurantId,
        active: true,
        ...(staffId ? { id: staffId } : {}),
        ...(email ? { email } : {}),
      },
      include: {
        roles: true,
      },
    });

    if (!staff) {
      return reply.status(401).send({ error: 'Staff member not found or inactive' });
    }

    const roles = staff.roles.map((r) => r.role as StaffRole);

    const token = jwt.sign({
      sub: staff.id,
      type: 'STAFF',
      restaurantId: staff.restaurantId,
      roles,
      name: staff.name,
      email: staff.email,
    });

    return {
      token,
      actor: {
        id: staff.id,
        type: 'STAFF',
        restaurantId: staff.restaurantId,
        name: staff.name,
        roles,
      },
    };
  });

  // POST /api/auth/device-auth
  app.post('/device-auth', async (request, reply) => {
    const parse = TableDeviceAuthSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parse.error.format() });
    }

    const { deviceId, restaurantId } = parse.data;

    const device = await prisma.tableDevice.findFirst({
      where: {
        id: deviceId,
        restaurantId,
        active: true,
      },
    });

    if (!device) {
      return reply.status(401).send({ error: 'Device not found, inactive or unauthorized' });
    }

    const token = jwt.sign({
      sub: device.id,
      type: 'TABLE_DEVICE',
      restaurantId: device.restaurantId,
      tableId: device.tableId,
      name: device.name,
    });

    return {
      token,
      actor: {
        id: device.id,
        type: 'TABLE_DEVICE',
        restaurantId: device.restaurantId,
        name: device.name,
      },
    };
  });

  // POST /api/auth/customer-session-token
  app.post('/customer-session-token', async (request, reply) => {
    const parse = CustomerSessionAuthSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parse.error.format() });
    }

    const { restaurantId, customerId: inputCustomerId, tableSessionId, name } = parse.data;
    const customerId = inputCustomerId || randomUUID();

    const token = jwt.sign({
      sub: customerId,
      type: 'CUSTOMER',
      restaurantId,
      tableSessionId: tableSessionId ?? null,
      name: name ?? undefined,
    });

    return {
      token,
      actor: {
        id: customerId,
        type: 'CUSTOMER',
        restaurantId,
        name: name || `Cliente #${customerId.slice(0, 6)}`,
      },
    };
  });

  // GET /api/auth/me
  app.get('/me', async (request, reply) => {
    if (!request.actor) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    return {
      actor: {
        id: request.actor.id,
        type: request.actor.type,
        restaurantId: request.actor.restaurantId,
      },
      tokenPayload: request.tokenPayload ?? null,
    };
  });
}
