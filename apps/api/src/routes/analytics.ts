import { FastifyPluginAsync } from 'fastify';
import { GetLiveOperationsUseCase } from '@restaurant-os/application';
import {
  PrismaTableRepository,
  PrismaTableSessionRepository,
  PrismaWaitlistRepository,
  PrismaKitchenOrderRepository,
  PrismaAccountRepository,
  PrismaServiceTaskRepository,
  PrismaOrderRepository,
  PrismaRawMaterialRepository,
  requirePermission,
  validateRestaurantAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  const tableRepo = new PrismaTableRepository();
  const sessionRepo = new PrismaTableSessionRepository();
  const waitlistRepo = new PrismaWaitlistRepository();
  const kitchenRepo = new PrismaKitchenOrderRepository();
  const accountRepo = new PrismaAccountRepository();
  const taskRepo = new PrismaServiceTaskRepository();
  const orderRepo = new PrismaOrderRepository();
  const rawMaterialRepo = new PrismaRawMaterialRepository();

  const getLiveOperations = new GetLiveOperationsUseCase(
    tableRepo,
    sessionRepo,
    waitlistRepo,
    kitchenRepo,
    accountRepo,
    taskRepo,
    orderRepo,
    rawMaterialRepo,
  );

  fastify.get(
    '/live-operations',
    {
      preHandler: [
        requirePermission(Permission.ANALYTICS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId is required' });
      }

      try {
        const report = await getLiveOperations.execute(restaurantId);
        return reply.send(report);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message || 'Internal server error' });
      }
    },
  );
};
