import { FastifyInstance } from 'fastify';
import {
  requirePermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';
import {
  CreateTableSessionSchema,
  TableSessionResponseSchema,
  ChangeWaiterSchema,
  ChangeTableSchema,
  AddCustomerToSessionSchema,
} from '@restaurant-os/contracts';
import {
  CreateTableSessionUseCase,
  CloseTableSessionUseCase,
  ChangeWaiterUseCase,
  ChangeSessionTableUseCase,
  AddCustomerToSessionUseCase,
  RemoveCustomerFromSessionUseCase,
  type TableRepository,
  type TableSessionRepository,
  type OrderRepository,
  type EventPublisher,
  type TransactionRunner,
} from '@restaurant-os/application';

export interface TableSessionRoutesOptions {
  tableRepo: TableRepository;
  sessionRepo: TableSessionRepository;
  eventPublisher: EventPublisher;
  orderRepo?: OrderRepository;
  txRunner?: TransactionRunner;
}

export async function tableSessionRoutes(
  app: FastifyInstance,
  opts: TableSessionRoutesOptions,
) {
  const createUseCase = new CreateTableSessionUseCase(
    opts.tableRepo,
    opts.sessionRepo,
    opts.eventPublisher,
  );
  const closeUseCase = new CloseTableSessionUseCase(
    opts.tableRepo,
    opts.sessionRepo,
    opts.eventPublisher,
    opts.orderRepo,
  );
  const changeWaiterUseCase = new ChangeWaiterUseCase(
    opts.sessionRepo,
    opts.eventPublisher,
  );
  const changeTableUseCase = new ChangeSessionTableUseCase(
    opts.sessionRepo,
    opts.tableRepo,
    opts.eventPublisher,
    opts.txRunner,
  );
  const addCustomerUseCase = new AddCustomerToSessionUseCase(
    opts.sessionRepo,
    opts.eventPublisher,
  );
  const removeCustomerUseCase = new RemoveCustomerFromSessionUseCase(
    opts.sessionRepo,
    opts.eventPublisher,
  );

  const formatSession = (s: any) =>
    TableSessionResponseSchema.parse({
      id: s.id,
      restaurantId: s.restaurantId,
      tableId: s.tableId,
      status: s.status,
      customerIds: Array.from(s.customerIds ?? []),
      currentWaiterId: s.currentWaiterId,
      tableHistory: s.tableHistory ? Array.from(s.tableHistory).map((h: any) => ({
        tableId: h.tableId,
        assignedAt: h.assignedAt.toISOString(),
        releasedAt: h.releasedAt?.toISOString(),
      })) : undefined,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    });

  // POST /api/table-sessions
  app.post(
    '/',
    {
      preHandler: [
        requirePermission(Permission.TABLE_SESSIONS_MANAGE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateTableSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const input = parsed.data;
      const result = await createUseCase.execute({
        id: input.id ?? randomUUID(),
        restaurantId: input.restaurantId,
        tableId: input.tableId,
        initialWaiterId: input.initialWaiterId,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(formatSession(result.value));
    },
  );

  // GET /api/table-sessions?restaurantId=...
  app.get(
    '/',
    {
      preHandler: [
        requirePermission(Permission.TABLE_SESSIONS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const sessions = await opts.sessionRepo.findByRestaurantId(restaurantId);
      return sessions.map((s) => formatSession(s));
    },
  );

  // GET /api/table-sessions/:id
  app.get(
    '/:id',
    {
      preHandler: [
        requirePermission(Permission.TABLE_SESSIONS_READ),
        requireResourceAccess('table-session'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = await opts.sessionRepo.findById(id);
      if (!session) {
        return reply.status(404).send({ error: 'TableSession not found' });
      }
      if (request.actor.restaurantId && session.restaurantId !== request.actor.restaurantId && !request.actor.isSystem()) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied to other restaurant data' });
      }
      return formatSession(session);
    },
  );

  // Close Table Session handler
  const closeSessionHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const session = await opts.sessionRepo.findById(id);
    if (!session) {
      return reply.status(404).send({ error: 'TableSession not found' });
    }
    if (request.actor.restaurantId && session.restaurantId !== request.actor.restaurantId && !request.actor.isSystem()) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied to other restaurant data' });
    }

    const isOnlyWaiter = request.actor?.roles?.includes('WAITER') && !request.actor?.roles?.includes('CASHIER') && !request.actor?.roles?.includes('ADMIN');
    const result = await closeUseCase.execute({
      sessionId: id,
      actorType: request.actor?.type,
      actorId: request.actor?.id,
      onlyIfNoConsumption: isOnlyWaiter,
    });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return formatSession(result.value);
  };

  app.post('/:id/close', { preHandler: [requirePermission(Permission.TABLE_SESSIONS_MANAGE), requireResourceAccess('table-session')] }, closeSessionHandler);
  app.patch('/:id/close', { preHandler: [requirePermission(Permission.TABLE_SESSIONS_MANAGE), requireResourceAccess('table-session')] }, closeSessionHandler);

  // Change Waiter handler
  const changeWaiterHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const session = await opts.sessionRepo.findById(id);
    if (!session) {
      return reply.status(404).send({ error: 'TableSession not found' });
    }
    if (request.actor.restaurantId && session.restaurantId !== request.actor.restaurantId && !request.actor.isSystem()) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied to other restaurant data' });
    }

    const parsed = ChangeWaiterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const result = await changeWaiterUseCase.execute({
      sessionId: id,
      newWaiterId: parsed.data.newWaiterId,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }

    return formatSession(result.value);
  };

  app.post('/:id/change-waiter', { preHandler: [requirePermission(Permission.TABLE_SESSIONS_CHANGE_WAITER), requireResourceAccess('table-session')] }, changeWaiterHandler);
  app.patch('/:id/change-waiter', { preHandler: [requirePermission(Permission.TABLE_SESSIONS_CHANGE_WAITER), requireResourceAccess('table-session')] }, changeWaiterHandler);

  // Change Table handler
  const changeTableHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const session = await opts.sessionRepo.findById(id);
    if (!session) {
      return reply.status(404).send({ error: 'TableSession not found' });
    }
    if (request.actor.restaurantId && session.restaurantId !== request.actor.restaurantId && !request.actor.isSystem()) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied to other restaurant data' });
    }

    const parsed = ChangeTableSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    try {
      const updated = await changeTableUseCase.execute({
        sessionId: id,
        newTableId: parsed.data.newTableId,
      });
      return formatSession(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  };

  app.post('/:id/change-table', { preHandler: [requirePermission(Permission.TABLES_ASSIGN), requireResourceAccess('table-session')] }, changeTableHandler);
  app.patch('/:id/change-table', { preHandler: [requirePermission(Permission.TABLES_ASSIGN), requireResourceAccess('table-session')] }, changeTableHandler);

  // POST /api/table-sessions/:id/customers
  app.post(
    '/:id/customers',
    {
      preHandler: [
        requirePermission(Permission.TABLE_SESSIONS_MANAGE),
        requireResourceAccess('table-session'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = await opts.sessionRepo.findById(id);
      if (!session) {
        return reply.status(404).send({ error: 'TableSession not found' });
      }
      if (request.actor.restaurantId && session.restaurantId !== request.actor.restaurantId && !request.actor.isSystem()) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied to other restaurant data' });
      }

      const parsed = AddCustomerToSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      try {
        const updated = await addCustomerUseCase.execute({
          sessionId: id,
          customerId: parsed.data.customerId,
        });
        return formatSession(updated);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  // DELETE /api/table-sessions/:id/customers/:customerId
  app.delete(
    '/:id/customers/:customerId',
    {
      preHandler: [
        requirePermission(Permission.TABLE_SESSIONS_MANAGE),
        requireResourceAccess('table-session'),
      ],
    },
    async (request, reply) => {
      const { id, customerId } = request.params as { id: string; customerId: string };
      const session = await opts.sessionRepo.findById(id);
      if (!session) {
        return reply.status(404).send({ error: 'TableSession not found' });
      }
      if (request.actor.restaurantId && session.restaurantId !== request.actor.restaurantId && !request.actor.isSystem()) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied to other restaurant data' });
      }

      try {
        const updated = await removeCustomerUseCase.execute({
          sessionId: id,
          customerId,
        });
        return formatSession(updated);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );
}
