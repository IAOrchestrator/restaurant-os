import { FastifyInstance } from 'fastify';
import {
  requirePermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';
import {
  CreateTableSchema,
  TableResponseSchema,
} from '@restaurant-os/contracts';
import {
  AssignTableUseCase,
  OccupyTableUseCase,
  CloseTableSessionUseCase,
  type TableRepository,
  type TableSessionRepository,
  type EventPublisher,
} from '@restaurant-os/application';
import { Table } from '@restaurant-os/domain';

export interface TableRoutesOptions {
  tableRepo: TableRepository;
  sessionRepo: TableSessionRepository;
  eventPublisher: EventPublisher;
}

export async function tableRoutes(app: FastifyInstance, opts: TableRoutesOptions) {
  const assignUseCase = new AssignTableUseCase(opts.tableRepo, opts.eventPublisher);
  const occupyUseCase = new OccupyTableUseCase(
    opts.tableRepo,
    opts.sessionRepo,
    opts.eventPublisher,
  );
  const closeSessionUseCase = new CloseTableSessionUseCase(
    opts.tableRepo,
    opts.sessionRepo,
    opts.eventPublisher,
  );

  // POST /api/tables
  app.post(
    '/',
    {
      preHandler: [
        requirePermission(Permission.TABLES_ASSIGN),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateTableSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const { restaurantId, number, capacity } = parsed.data;
      const tableResult = Table.create({
        id: randomUUID(),
        restaurantId,
        number,
        capacity,
      });

      if (!tableResult.success) {
        return reply.status(400).send({ error: tableResult.error.message });
      }

      await opts.tableRepo.save(tableResult.value);
      return reply.status(201).send(
        TableResponseSchema.parse({
          id: tableResult.value.id,
          restaurantId: tableResult.value.restaurantId,
          number: tableResult.value.number,
          capacity: tableResult.value.capacity,
          status: tableResult.value.status,
          createdAt: tableResult.value.createdAt.toISOString(),
          updatedAt: tableResult.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/tables?restaurantId=...
  app.get(
    '/',
    {
      preHandler: [
        requirePermission(Permission.TABLES_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const tables = await opts.tableRepo.findByRestaurantId(restaurantId);
      return tables.map((t) =>
        TableResponseSchema.parse({
          id: t.id,
          restaurantId: t.restaurantId,
          number: t.number,
          capacity: t.capacity,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/tables/:id
  app.get(
    '/:id',
    {
      preHandler: [
        requirePermission(Permission.TABLES_READ),
        requireResourceAccess('table'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const table = await opts.tableRepo.findById(id);
      if (!table) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      return TableResponseSchema.parse({
        id: table.id,
        restaurantId: table.restaurantId,
        number: table.number,
        capacity: table.capacity,
        status: table.status,
        createdAt: table.createdAt.toISOString(),
        updatedAt: table.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/tables/:id/assign
  app.patch(
    '/:id/assign',
    {
      preHandler: [
        requirePermission(Permission.TABLES_ASSIGN),
        requireResourceAccess('table'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await assignUseCase.execute({ tableId: id });
      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }
      return TableResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        number: result.value.number,
        capacity: result.value.capacity,
        status: result.value.status,
        createdAt: result.value.createdAt.toISOString(),
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/tables/:id/occupy
  app.patch(
    '/:id/occupy',
    {
      preHandler: [
        requirePermission(Permission.TABLES_OCCUPY),
        requireResourceAccess('table'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { sessionId } = request.body as { sessionId: string };
      if (!sessionId) {
        return reply.status(400).send({ error: 'sessionId is required' });
      }

      const result = await occupyUseCase.execute({ tableId: id, sessionId });
      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }
      return {
        table: TableResponseSchema.parse({
          id: result.value.table.id,
          restaurantId: result.value.table.restaurantId,
          number: result.value.table.number,
          capacity: result.value.table.capacity,
          status: result.value.table.status,
          createdAt: result.value.table.createdAt.toISOString(),
          updatedAt: result.value.table.updatedAt.toISOString(),
        }),
        session: {
          id: result.value.session.id,
          status: result.value.session.status,
        },
      };
    },
  );

  // Release table handler
  const releaseHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const table = await opts.tableRepo.findById(id);
    if (!table) {
      return reply.status(404).send({ error: 'Table not found' });
    }

    const activeSession = await opts.sessionRepo.findActiveByTableId(id);
    if (activeSession) {
      const closeResult = await closeSessionUseCase.execute({ sessionId: activeSession.id });
      if (!closeResult.success) {
        return reply.status(400).send({ error: closeResult.error.message });
      }
    } else {
      const releaseResult = table.release();
      if (releaseResult.success) {
        await opts.tableRepo.save(releaseResult.value);
        await opts.eventPublisher.publish('TABLE_RELEASED', {
          tableId: table.id,
          restaurantId: table.restaurantId,
        });
      }
    }

    const updated = await opts.tableRepo.findById(id);
    return TableResponseSchema.parse({
      id: updated!.id,
      restaurantId: updated!.restaurantId,
      number: updated!.number,
      capacity: updated!.capacity,
      status: updated!.status,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    });
  };

  // POST /api/tables/:id/release
  app.post(
    '/:id/release',
    {
      preHandler: [
        requirePermission(Permission.TABLES_RELEASE),
        requireResourceAccess('table'),
      ],
    },
    releaseHandler,
  );

  // PATCH /api/tables/:id/release
  app.patch(
    '/:id/release',
    {
      preHandler: [
        requirePermission(Permission.TABLES_RELEASE),
        requireResourceAccess('table'),
      ],
    },
    releaseHandler,
  );
}

