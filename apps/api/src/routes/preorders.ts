import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import {
  CreatePreOrderSchema,
  PreOrderResponseSchema,
} from '@restaurant-os/contracts';
import {
  CreatePreOrderUseCase,
  ConfirmPreOrderUseCase,
  CancelPreOrderUseCase,
  type PreOrderRepository,
  type EventPublisher,
} from '@restaurant-os/application';
import {
  requirePermission,
  requireAnyPermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';

export interface PreOrderRoutesOptions {
  preOrderRepo: PreOrderRepository;
  eventPublisher: EventPublisher;
}

export async function preOrderRoutes(app: FastifyInstance, opts: PreOrderRoutesOptions) {
  const createUseCase = new CreatePreOrderUseCase(opts.preOrderRepo, opts.eventPublisher);
  const confirmUseCase = new ConfirmPreOrderUseCase(opts.preOrderRepo, opts.eventPublisher);
  const cancelUseCase = new CancelPreOrderUseCase(opts.preOrderRepo, opts.eventPublisher);

  // POST /api/preorders
  app.post(
    '/',
    {
      preHandler: [
        requireAnyPermission(Permission.PREORDERS_CREATE, Permission.ORDERS_CREATE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreatePreOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await createUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        restaurantId: parsed.data.restaurantId,
        customerId: parsed.data.customerId,
        items: parsed.data.items,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(
        PreOrderResponseSchema.parse({
          id: result.value.id,
          restaurantId: result.value.restaurantId,
          customerId: result.value.customerId,
          status: result.value.status,
          items: result.value.items,
          createdAt: result.value.createdAt.toISOString(),
          updatedAt: result.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/preorders?restaurantId=...
  app.get(
    '/',
    {
      preHandler: [
        requirePermission(Permission.PREORDERS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const preOrders = await opts.preOrderRepo.findByRestaurantId(restaurantId);
      return preOrders.map((p) =>
        PreOrderResponseSchema.parse({
          id: p.id,
          restaurantId: p.restaurantId,
          customerId: p.customerId,
          status: p.status,
          items: p.items,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/preorders/:id
  app.get(
    '/:id',
    {
      preHandler: [
        requirePermission(Permission.PREORDERS_READ),
        requireResourceAccess('preorder'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const preOrder = await opts.preOrderRepo.findById(id);
      if (!preOrder) {
        return reply.status(404).send({ error: 'PreOrder not found' });
      }
      return PreOrderResponseSchema.parse({
        id: preOrder.id,
        restaurantId: preOrder.restaurantId,
        customerId: preOrder.customerId,
        status: preOrder.status,
        items: preOrder.items,
        createdAt: preOrder.createdAt.toISOString(),
        updatedAt: preOrder.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/preorders/:id/confirm
  app.patch(
    '/:id/confirm',
    {
      preHandler: [
        requirePermission(Permission.PREORDERS_UPDATE),
        requireResourceAccess('preorder'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await confirmUseCase.execute({ preOrderId: id });
      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }
      return PreOrderResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        customerId: result.value.customerId,
        status: result.value.status,
        items: result.value.items,
        createdAt: result.value.createdAt.toISOString(),
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/preorders/:id/cancel
  app.patch(
    '/:id/cancel',
    {
      preHandler: [
        requirePermission(Permission.PREORDERS_UPDATE),
        requireResourceAccess('preorder'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await cancelUseCase.execute({ preOrderId: id });
      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }
      return PreOrderResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        customerId: result.value.customerId,
        status: result.value.status,
        items: result.value.items,
        createdAt: result.value.createdAt.toISOString(),
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );
}
