import { FastifyInstance } from 'fastify';
import {
  requirePermission,
  requireAnyPermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';
import {
  CreateOrderSchema,
  OrderResponseSchema,
} from '@restaurant-os/contracts';
import {
  CreateOrderUseCase,
  SendToKitchenUseCase,
  StartPreparingUseCase,
  MarkOrderReadyUseCase,
  DeliverOrderUseCase,
  CancelOrderUseCase,
  type OrderRepository,
  type PreOrderRepository,
  type KitchenOrderRepository,
  type TableSessionRepository,
  type TableRepository,
  type ProductRepository,
  type EventPublisher,
  type TransactionRunner,
} from '@restaurant-os/application';

export interface OrderRoutesOptions {
  orderRepo: OrderRepository;
  preOrderRepo: PreOrderRepository;
  eventPublisher: EventPublisher;
  kitchenOrderRepo?: KitchenOrderRepository;
  sessionRepo?: TableSessionRepository;
  tableRepo?: TableRepository;
  txRunner?: TransactionRunner;
  productRepo?: ProductRepository;
}

export async function orderRoutes(app: FastifyInstance, opts: OrderRoutesOptions) {
  const createUseCase = new CreateOrderUseCase(
    opts.orderRepo,
    opts.preOrderRepo,
    opts.eventPublisher,
  );
  const sendToKitchenUseCase = new SendToKitchenUseCase(
    opts.orderRepo,
    opts.eventPublisher,
    opts.kitchenOrderRepo,
    opts.sessionRepo,
    opts.tableRepo,
    opts.txRunner,
    opts.productRepo,
  );
  const startPreparingUseCase = new StartPreparingUseCase(opts.orderRepo, opts.eventPublisher);
  const markReadyUseCase = new MarkOrderReadyUseCase(opts.orderRepo, opts.eventPublisher);
  const deliverUseCase = new DeliverOrderUseCase(
    opts.orderRepo,
    opts.eventPublisher,
    opts.kitchenOrderRepo,
    opts.sessionRepo,
    opts.tableRepo,
    opts.txRunner,
  );
  const cancelUseCase = new CancelOrderUseCase(opts.orderRepo, opts.eventPublisher);

  // POST /api/orders
  app.post(
    '/',
    {
      preHandler: [
        requireAnyPermission(Permission.ORDERS_CREATE, Permission.PREORDERS_CREATE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      // Enforce fine-grained contextual scoping for TABLE_DEVICE and CUSTOMER
      const scoper = request.resourceScoper;
      if (scoper && (request.actor.isTableDevice() || request.actor.isCustomer())) {
        if (parsed.data.tableSessionId) {
          const sessionScope = await scoper.getScope(request.actor, 'table-session');
          if (sessionScope.isOwn() && sessionScope.resourceIds !== null) {
            if (!sessionScope.canAccess(parsed.data.tableSessionId)) {
              return reply.status(403).send({
                error: 'Forbidden',
                message: `Access denied to table session outside actor scope: ${parsed.data.tableSessionId}`,
              });
            }
          }
        }
      }

      const result = await createUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        restaurantId: parsed.data.restaurantId,
        tableSessionId: parsed.data.tableSessionId ?? '00000000-0000-0000-0000-000000000000',
        customerId: parsed.data.customerId ?? null,
        preOrderId: parsed.data.preOrderId ?? null,
        type: parsed.data.type,
        items: parsed.data.items,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(
        OrderResponseSchema.parse({
          id: result.value.id,
          restaurantId: result.value.restaurantId,
          tableSessionId: result.value.tableSessionId,
          customerId: result.value.customerId,
          status: result.value.status,
          items: result.value.items,
          totalAmount: result.value.totalAmount,
          createdAt: result.value.createdAt.toISOString(),
          updatedAt: result.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/orders?restaurantId=...
  app.get(
    '/',
    {
      preHandler: [
        requirePermission(Permission.ORDERS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const orders = await opts.orderRepo.findByRestaurantId(restaurantId);
      return orders.map((o) =>
        OrderResponseSchema.parse({
          id: o.id,
          restaurantId: o.restaurantId,
          tableSessionId: o.tableSessionId,
          customerId: o.customerId,
          status: o.status,
          items: o.items,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/orders/:id
  app.get(
    '/:id',
    {
      preHandler: [
        requirePermission(Permission.ORDERS_READ),
        requireResourceAccess('order'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await opts.orderRepo.findById(id);
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' });
      }
      return OrderResponseSchema.parse({
        id: order.id,
        restaurantId: order.restaurantId,
        tableSessionId: order.tableSessionId,
        customerId: order.customerId,
        status: order.status,
        items: order.items,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/orders/:id/send-to-kitchen
  // Handler: send-to-kitchen
  const sendToKitchenHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await sendToKitchenUseCase.execute({
      orderId: id,
      actorType: request.actor?.type,
      actorId: request.actor?.id,
    });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return OrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      tableSessionId: result.value.tableSessionId,
      customerId: result.value.customerId,
      status: result.value.status,
      items: result.value.items,
      totalAmount: result.value.totalAmount,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/:id/send-to-kitchen', { preHandler: [requirePermission(Permission.ORDERS_SEND_TO_KITCHEN), requireResourceAccess('order')] }, sendToKitchenHandler);
  app.patch('/:id/send-to-kitchen', { preHandler: [requirePermission(Permission.ORDERS_SEND_TO_KITCHEN), requireResourceAccess('order')] }, sendToKitchenHandler);

  // Handler: start-preparing
  const startPreparingHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await startPreparingUseCase.execute({ orderId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return OrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      tableSessionId: result.value.tableSessionId,
      customerId: result.value.customerId,
      status: result.value.status,
      items: result.value.items,
      totalAmount: result.value.totalAmount,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/:id/start-preparing', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_START), requireResourceAccess('order')] }, startPreparingHandler);
  app.patch('/:id/start-preparing', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_START), requireResourceAccess('order')] }, startPreparingHandler);

  // Handler: ready
  const markReadyHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await markReadyUseCase.execute({ orderId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return OrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      tableSessionId: result.value.tableSessionId,
      customerId: result.value.customerId,
      status: result.value.status,
      items: result.value.items,
      totalAmount: result.value.totalAmount,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/:id/ready', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_READY), requireResourceAccess('order')] }, markReadyHandler);
  app.patch('/:id/ready', { preHandler: [requirePermission(Permission.KITCHEN_ORDERS_READY), requireResourceAccess('order')] }, markReadyHandler);

  // Handler: deliver
  const deliverHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await deliverUseCase.execute({
      orderId: id,
      actorType: request.actor?.type,
      actorId: request.actor?.id,
    });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return OrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      tableSessionId: result.value.tableSessionId,
      customerId: result.value.customerId,
      status: result.value.status,
      items: result.value.items,
      totalAmount: result.value.totalAmount,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/:id/deliver', { preHandler: [requirePermission(Permission.ORDERS_DELIVER), requireResourceAccess('order')] }, deliverHandler);
  app.patch('/:id/deliver', { preHandler: [requirePermission(Permission.ORDERS_DELIVER), requireResourceAccess('order')] }, deliverHandler);

  // Handler: cancel
  const cancelOrderHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await cancelUseCase.execute({ orderId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return OrderResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      tableSessionId: result.value.tableSessionId,
      customerId: result.value.customerId,
      status: result.value.status,
      items: result.value.items,
      totalAmount: result.value.totalAmount,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/:id/cancel', { preHandler: [requirePermission(Permission.ORDERS_UPDATE), requireResourceAccess('order')] }, cancelOrderHandler);
  app.patch('/:id/cancel', { preHandler: [requirePermission(Permission.ORDERS_UPDATE), requireResourceAccess('order')] }, cancelOrderHandler);
}
