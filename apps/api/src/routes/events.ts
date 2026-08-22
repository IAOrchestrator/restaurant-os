import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { CreateEventLogSchema, EventLogResponseSchema } from '@restaurant-os/contracts';
import {
  CreateEventLogUseCase,
  ListEventLogsUseCase,
  GetEventLogUseCase,
  ListEventsByAggregateUseCase,
  type EventLogRepository,
} from '@restaurant-os/application';
import {
  requirePermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';

export interface EventRoutesOptions {
  eventLogRepo: EventLogRepository;
}

export async function eventRoutes(app: FastifyInstance, opts: EventRoutesOptions) {
  const createUseCase = new CreateEventLogUseCase(opts.eventLogRepo);
  const listUseCase = new ListEventLogsUseCase(opts.eventLogRepo);
  const getUseCase = new GetEventLogUseCase(opts.eventLogRepo);
  const listByAggregateUseCase = new ListEventsByAggregateUseCase(opts.eventLogRepo);

  const formatEvent = (e: any) =>
    EventLogResponseSchema.parse({
      id: e.id,
      eventType: e.eventType,
      restaurantId: e.restaurantId,
      aggregateType: e.aggregateType,
      aggregateId: e.aggregateId,
      tableSessionId: e.tableSessionId ?? null,
      timestamp: e.timestamp.toISOString(),
      actorType: e.actorType,
      actorId: e.actorId,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    });

  // POST /api/events
  app.post(
    '/',
    {
      preHandler: [
        requirePermission(Permission.EVENTS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateEventLogSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await createUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        eventType: parsed.data.eventType,
        restaurantId: parsed.data.restaurantId,
        aggregateType: parsed.data.aggregateType,
        aggregateId: parsed.data.aggregateId,
        actorType: parsed.data.actorType,
        actorId: parsed.data.actorId,
        payload: parsed.data.payload,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(formatEvent(result.value));
    },
  );

  // GET /api/events?restaurantId=...&limit=...
  app.get(
    '/',
    {
      preHandler: [
        requirePermission(Permission.EVENTS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId, limit } = request.query as { restaurantId?: string; limit?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const events = await listUseCase.execute({
        restaurantId,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return events.map((e) => formatEvent(e));
    },
  );

  // GET /api/events/:id
  app.get(
    '/:id',
    {
      preHandler: [
        requirePermission(Permission.EVENTS_READ),
        requireResourceAccess('event'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const eventLog = await getUseCase.execute(id);
      if (!eventLog) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      return formatEvent(eventLog);
    },
  );

  // GET /api/events/aggregate/:aggregateId
  app.get(
    '/aggregate/:aggregateId',
    {
      preHandler: [
        requirePermission(Permission.EVENTS_READ),
      ],
    },
    async (request, _reply) => {
      const { aggregateId } = request.params as { aggregateId: string };
      const events = await listByAggregateUseCase.execute(aggregateId);
      return events.map((e) => formatEvent(e));
    },
  );

  // GET /api/events/session/:tableSessionId
  app.get(
    '/session/:tableSessionId',
    {
      preHandler: [
        requirePermission(Permission.EVENTS_READ),
      ],
    },
    async (request, _reply) => {
      const { tableSessionId } = request.params as { tableSessionId: string };
      const events = await opts.eventLogRepo.findByTableSessionId(tableSessionId);
      return events.map((e) => formatEvent(e));
    },
  );
}
