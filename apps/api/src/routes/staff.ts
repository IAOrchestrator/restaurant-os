import { FastifyInstance } from 'fastify';
import { prisma, requirePermission, validateRestaurantAccess } from '@restaurant-os/infrastructure';
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
}
