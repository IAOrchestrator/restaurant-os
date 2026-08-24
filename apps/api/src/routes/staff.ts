import { FastifyInstance } from 'fastify';
import { prisma, requirePermission, validateRestaurantAccess, Argon2PasswordHasher } from '@restaurant-os/infrastructure';
import { Permission, StaffRole } from '@restaurant-os/domain';

export async function staffRoutes(app: FastifyInstance) {
  // GET /api/staff?restaurantId=...&role=...
  app.get(
    '/',
    {
      preHandler: [
        requirePermission(Permission.STAFF_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId, role } = request.query as {
        restaurantId?: string;
        role?: StaffRole;
      };

      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const staffList = await prisma.staff.findMany({
        where: {
          restaurantId,
          active: true,
          ...(role ? { roles: { some: { role } } } : {}),
        },
        include: {
          roles: true,
        },
      });

      return staffList.map((s) => ({
        id: s.id,
        restaurantId: s.restaurantId,
        name: s.name,
        email: s.email,
        active: s.active,
        roles: s.roles.map((r) => r.role),
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }));
    },
  );

  // POST /api/staff
  app.post(
    '/',
    {
      preHandler: [
        requirePermission(Permission.STAFF_MANAGE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const body = request.body as {
        restaurantId: string;
        name: string;
        email?: string;
        role: StaffRole;
        password?: string;
        pin?: string;
      };

      if (!body.restaurantId || !body.name || !body.role) {
        return reply.status(400).send({ error: 'restaurantId, name and role are required' });
      }

      const hasher = new Argon2PasswordHasher();
      const passwordHash = body.password ? await hasher.hash(body.password) : null;
      const pinCodeHash = body.pin ? await hasher.hashPin(body.pin) : null;

      const createdStaff = await prisma.staff.create({
        data: {
          restaurantId: body.restaurantId,
          name: body.name.trim(),
          email: body.email?.trim() || `${body.name.toLowerCase().replace(/\s+/g, '')}@pizzeria.com`,
          active: true,
          passwordHash,
          pinCodeHash,
          roles: {
            create: {
              role: body.role,
            },
          },
        },
        include: {
          roles: true,
        },
      });

      return reply.status(201).send({
        id: createdStaff.id,
        restaurantId: createdStaff.restaurantId,
        name: createdStaff.name,
        email: createdStaff.email,
        active: createdStaff.active,
        roles: createdStaff.roles.map((r) => r.role),
        createdAt: createdStaff.createdAt.toISOString(),
        updatedAt: createdStaff.updatedAt.toISOString(),
      });
    },
  );
}
