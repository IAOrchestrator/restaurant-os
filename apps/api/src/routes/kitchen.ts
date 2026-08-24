import { FastifyInstance } from 'fastify';
import {
  requirePermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';
import {
  CreateKitchenOrderSchema,
  KitchenOrderResponseSchema,
} from '@restaurant-os/contracts';
import {
  CreateKitchenOrderUseCase,
  StartKitchenOrderUseCase,
  MarkNearlyReadyUseCase,
  MarkKitchenOrderReadyUseCase,
  CompleteKitchenOrderUseCase,
  AssignKitchenOrderUseCase,
  type KitchenOrderRepository,
  type OrderRepository,
  type TableSessionRepository,
  type TableRepository,
  type EventPublisher,
  type TransactionRunner,
} from '@restaurant-os/application';

export interface KitchenRoutesOptions {
  kitchenOrderRepo: KitchenOrderRepository;
  eventPublisher: EventPublisher;
  orderRepo?: OrderRepository;
  sessionRepo?: TableSessionRepository;
  tableRepo?: TableRepository;
  txRunner?: TransactionRunner;
}

export async function kitchenRoutes(app: FastifyInstance, opts: KitchenRoutesOptions) {
  const createUseCase = new CreateKitchenOrderUseCase(opts.kitchenOrderRepo, opts.eventPublisher);
  const startUseCase = new StartKitchenOrderUseCase(
    opts.kitchenOrderRepo,
    opts.eventPublisher,
    opts.orderRepo,
    opts.sessionRepo,
    opts.tableRepo,
    opts.txRunner,
  );
  const nearlyUseCase = new MarkNearlyReadyUseCase(opts.kitchenOrderRepo, opts.eventPublisher);
  const readyUseCase = new MarkKitchenOrderReadyUseCase(
    opts.kitchenOrderRepo,
    opts.eventPublisher,
    opts.orderRepo,
    opts.sessionRepo,
    opts.tableRepo,
    opts.txRunner,
  );
  const completeUseCase = new CompleteKitchenOrderUseCase(opts.kitchenOrderRepo, opts.eventPublisher);
  const assignUseCase = new AssignKitchenOrderUseCase(opts.kitchenOrderRepo, opts.eventPublisher);

  // POST /api/kitchen/orders
  app.post(
    '/orders',
    {
      preHandler: [
        requirePermission(Permission.KITCHEN_ORDERS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateKitchenOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await createUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        restaurantId: parsed.data.restaurantId,
        orderId: parsed.data.orderId,
        assignedTo: parsed.data.assignedTo,
        priority: parsed.data.priority,
        notes: parsed.data.notes,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(
        KitchenOrderResponseSchema.parse({
          id: result.value.id,
          restaurantId: result.value.restaurantId,
          orderId: result.value.orderId,
          status: result.value.status,
          assignedTo: result.value.assignedTo,
          priority: result.value.priority,
          receivedAt: result.value.receivedAt.toISOString(),
          startedAt: result.value.startedAt?.toISOString() ?? null,
          nearlyReadyAt: result.value.nearlyReadyAt?.toISOString() ?? null,
          readyAt: result.value.readyAt?.toISOString() ?? null,
          completedAt: result.value.completedAt?.toISOString() ?? null,
          notes: result.value.notes,
          createdAt: result.value.createdAt.toISOString(),
          updatedAt: result.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/kitchen/orders?restaurantId=...&status=...
  app.get(
    '/orders',
    {
      preHandler: [
        requirePermission(Permission.KITCHEN_ORDERS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId, status } = request.query as { restaurantId?: string; status?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const orders = await opts.kitchenOrderRepo.findByRestaurantId(restaurantId, status);
      return orders.map((o) =>
        KitchenOrderResponseSchema.parse({
          id: o.id,
          restaurantId: o.restaurantId,
          orderId: o.orderId,
          status: o.status,
          assignedTo: o.assignedTo,
          priority: o.priority,
          receivedAt: o.receivedAt.toISOString(),
          startedAt: o.startedAt?.toISOString() ?? null,
          nearlyReadyAt: o.nearlyReadyAt?.toISOString() ?? null,
          readyAt: o.readyAt?.toISOString() ?? null,
          completedAt: o.completedAt?.toISOString() ?? null,
          notes: o.notes,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/kitchen/orders/:id
  app.get(
    '/orders/:id',
    {
      preHandler: [
        requirePermission(Permission.KITCHEN_ORDERS_READ),
        requireResourceAccess('kitchen-order'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await opts.kitchenOrderRepo.findById(id);
      if (!order) {
        return reply.status(404).send({ error: 'Kitchen order not found' });
      }

      return KitchenOrderResponseSchema.parse({
        id: order.id,
        restaurantId: order.restaurantId,
        orderId: order.orderId,
        status: order.status,
        assignedTo: order.assignedTo,
        priority: order.priority,
        receivedAt: order.receivedAt.toISOString(),
        startedAt: order.startedAt?.toISOString() ?? null,
        nearlyReadyAt: order.nearlyReadyAt?.toISOString() ?? null,
        readyAt: order.readyAt?.toISOString() ?? null,
        completedAt: order.completedAt?.toISOString() ?? null,
        notes: order.notes,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      });
    },
  );

  // Handler: start
  const startHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await startUseCase.execute({
      kitchenOrderId: id,
      actorType: request.actor?.type,
      actorId: request.actor?.id,
    });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return KitchenOrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      orderId: result.value.orderId,
      status: result.value.status,
      assignedTo: result.value.assignedTo,
      priority: result.value.priority,
      receivedAt: result.value.receivedAt.toISOString(),
      startedAt: result.value.startedAt?.toISOString() ?? null,
      nearlyReadyAt: result.value.nearlyReadyAt?.toISOString() ?? null,
      readyAt: result.value.readyAt?.toISOString() ?? null,
      completedAt: result.value.completedAt?.toISOString() ?? null,
      notes: result.value.notes,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/orders/:id/start', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_START), requireResourceAccess('kitchen-order')] }, startHandler);
  app.patch('/orders/:id/start', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_START), requireResourceAccess('kitchen-order')] }, startHandler);

  // Handler: nearly-ready
  const nearlyHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await nearlyUseCase.execute({ kitchenOrderId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return KitchenOrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      orderId: result.value.orderId,
      status: result.value.status,
      assignedTo: result.value.assignedTo,
      priority: result.value.priority,
      receivedAt: result.value.receivedAt.toISOString(),
      startedAt: result.value.startedAt?.toISOString() ?? null,
      nearlyReadyAt: result.value.nearlyReadyAt?.toISOString() ?? null,
      readyAt: result.value.readyAt?.toISOString() ?? null,
      completedAt: result.value.completedAt?.toISOString() ?? null,
      notes: result.value.notes,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/orders/:id/nearly-ready', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_READY), requireResourceAccess('kitchen-order')] }, nearlyHandler);
  app.patch('/orders/:id/nearly-ready', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_READY), requireResourceAccess('kitchen-order')] }, nearlyHandler);

  // Handler: ready
  const readyHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await readyUseCase.execute({
      kitchenOrderId: id,
      actorType: request.actor?.type,
      actorId: request.actor?.id,
    });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return KitchenOrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      orderId: result.value.orderId,
      status: result.value.status,
      assignedTo: result.value.assignedTo,
      priority: result.value.priority,
      receivedAt: result.value.receivedAt.toISOString(),
      startedAt: result.value.startedAt?.toISOString() ?? null,
      nearlyReadyAt: result.value.nearlyReadyAt?.toISOString() ?? null,
      readyAt: result.value.readyAt?.toISOString() ?? null,
      completedAt: result.value.completedAt?.toISOString() ?? null,
      notes: result.value.notes,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/orders/:id/ready', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_READY), requireResourceAccess('kitchen-order')] }, readyHandler);
  app.patch('/orders/:id/ready', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_READY), requireResourceAccess('kitchen-order')] }, readyHandler);

  // Handler: complete
  const completeHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await completeUseCase.execute({ kitchenOrderId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return KitchenOrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      orderId: result.value.orderId,
      status: result.value.status,
      assignedTo: result.value.assignedTo,
      priority: result.value.priority,
      receivedAt: result.value.receivedAt.toISOString(),
      startedAt: result.value.startedAt?.toISOString() ?? null,
      nearlyReadyAt: result.value.nearlyReadyAt?.toISOString() ?? null,
      readyAt: result.value.readyAt?.toISOString() ?? null,
      completedAt: result.value.completedAt?.toISOString() ?? null,
      notes: result.value.notes,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/orders/:id/complete', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_COMPLETE), requireResourceAccess('kitchen-order')] }, completeHandler);
  app.patch('/orders/:id/complete', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_COMPLETE), requireResourceAccess('kitchen-order')] }, completeHandler);

  // Handler: assign
  const assignHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const { staffId } = request.body as { staffId: string };
    if (!staffId) {
      return reply.status(400).send({ error: 'staffId is required' });
    }

    const result = await assignUseCase.execute({ kitchenOrderId: id, staffId });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return KitchenOrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      orderId: result.value.orderId,
      status: result.value.status,
      assignedTo: result.value.assignedTo,
      priority: result.value.priority,
      receivedAt: result.value.receivedAt.toISOString(),
      startedAt: result.value.startedAt?.toISOString() ?? null,
      nearlyReadyAt: result.value.nearlyReadyAt?.toISOString() ?? null,
      readyAt: result.value.readyAt?.toISOString() ?? null,
      completedAt: result.value.completedAt?.toISOString() ?? null,
      notes: result.value.notes,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/orders/:id/assign', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_ASSIGN), requireResourceAccess('kitchen-order')] }, assignHandler);
  app.patch('/orders/:id/assign', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_ASSIGN), requireResourceAccess('kitchen-order')] }, assignHandler);
}
