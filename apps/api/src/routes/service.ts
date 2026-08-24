import { FastifyInstance } from 'fastify';
import {
  requirePermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';
import {
  CreateServiceTaskSchema,
  ServiceTaskResponseSchema,
} from '@restaurant-os/contracts';
import {
  CreateServiceTaskUseCase,
  AssignServiceTaskUseCase,
  StartServiceTaskUseCase,
  CompleteServiceTaskUseCase,
  CancelServiceTaskUseCase,
  type ServiceTaskRepository,
  type EventPublisher,
} from '@restaurant-os/application';

export interface ServiceRoutesOptions {
  serviceTaskRepo: ServiceTaskRepository;
  eventPublisher: EventPublisher;
}

export async function serviceRoutes(app: FastifyInstance, opts: ServiceRoutesOptions) {
  const createUseCase = new CreateServiceTaskUseCase(opts.serviceTaskRepo, opts.eventPublisher);
  const assignUseCase = new AssignServiceTaskUseCase(opts.serviceTaskRepo, opts.eventPublisher);
  const startUseCase = new StartServiceTaskUseCase(opts.serviceTaskRepo, opts.eventPublisher);
  const completeUseCase = new CompleteServiceTaskUseCase(opts.serviceTaskRepo, opts.eventPublisher);
  const cancelUseCase = new CancelServiceTaskUseCase(opts.serviceTaskRepo, opts.eventPublisher);

  // POST /api/service/tasks
  app.post(
    '/tasks',
    {
      preHandler: [
        requirePermission(Permission.SERVICE_TASKS_MANAGE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateServiceTaskSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      // Enforce fine-grained contextual scoping for TABLE_DEVICE and CUSTOMER
      const scoper = request.resourceScoper;
      if (scoper && (request.actor.isTableDevice() || request.actor.isCustomer())) {
        const sessionScope = await scoper.getScope(request.actor, 'table-session');
        if (sessionScope.isOwn() && sessionScope.resourceIds !== null) {
          if (parsed.data.tableSessionId && !sessionScope.canAccess(parsed.data.tableSessionId)) {
            return reply.status(403).send({
              error: 'Forbidden',
              message: `Access denied to table session outside actor scope: ${parsed.data.tableSessionId}`,
            });
          }
        }
      }

      const result = await createUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        restaurantId: parsed.data.restaurantId,
        tableSessionId: parsed.data.tableSessionId,
        type: parsed.data.type,
        notes: parsed.data.notes,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(
        ServiceTaskResponseSchema.parse({
          id: result.value.id,
          restaurantId: result.value.restaurantId,
          tableSessionId: result.value.tableSessionId,
          type: result.value.type,
          status: result.value.status,
          assignedTo: result.value.assignedTo,
          notes: result.value.notes,
          createdAt: result.value.createdAt.toISOString(),
          assignedAt: result.value.assignedAt?.toISOString() ?? null,
          startedAt: result.value.startedAt?.toISOString() ?? null,
          completedAt: result.value.completedAt?.toISOString() ?? null,
          updatedAt: result.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/service/tasks?restaurantId=...&status=...
  app.get(
    '/tasks',
    {
      preHandler: [
        requirePermission(Permission.SERVICE_TASKS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId, status } = request.query as { restaurantId?: string; status?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const tasks = await opts.serviceTaskRepo.findByRestaurantId(restaurantId, status);
      return tasks.map((t) =>
        ServiceTaskResponseSchema.parse({
          id: t.id,
          restaurantId: t.restaurantId,
          tableSessionId: t.tableSessionId,
          type: t.type,
          status: t.status,
          assignedTo: t.assignedTo,
          notes: t.notes,
          createdAt: t.createdAt.toISOString(),
          assignedAt: t.assignedAt?.toISOString() ?? null,
          startedAt: t.startedAt?.toISOString() ?? null,
          completedAt: t.completedAt?.toISOString() ?? null,
          updatedAt: t.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/service/tasks/:id
  app.get(
    '/tasks/:id',
    {
      preHandler: [
        requirePermission(Permission.SERVICE_TASKS_READ),
        requireResourceAccess('service-task'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const task = await opts.serviceTaskRepo.findById(id);
      if (!task) {
        return reply.status(404).send({ error: 'Service task not found' });
      }

      return ServiceTaskResponseSchema.parse({
        id: task.id,
        restaurantId: task.restaurantId,
        tableSessionId: task.tableSessionId,
        type: task.type,
        status: task.status,
        assignedTo: task.assignedTo,
        notes: task.notes,
        createdAt: task.createdAt.toISOString(),
        assignedAt: task.assignedAt?.toISOString() ?? null,
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        updatedAt: task.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/service/tasks/:id/assign
  app.patch(
    '/tasks/:id/assign',
    {
      preHandler: [
        requirePermission(Permission.SERVICE_TASKS_MANAGE),
        requireResourceAccess('service-task'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { staffId } = request.body as { staffId: string };
      if (!staffId) {
        return reply.status(400).send({ error: 'staffId is required' });
      }

      const result = await assignUseCase.execute({ serviceTaskId: id, staffId });
      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }
      return ServiceTaskResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        tableSessionId: result.value.tableSessionId,
        type: result.value.type,
        status: result.value.status,
        assignedTo: result.value.assignedTo,
        notes: result.value.notes,
        createdAt: result.value.createdAt.toISOString(),
        assignedAt: result.value.assignedAt?.toISOString() ?? null,
        startedAt: result.value.startedAt?.toISOString() ?? null,
        completedAt: result.value.completedAt?.toISOString() ?? null,
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/service/tasks/:id/start
  app.patch(
    '/tasks/:id/start',
    {
      preHandler: [
        requirePermission(Permission.SERVICE_TASKS_MANAGE),
        requireResourceAccess('service-task'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await startUseCase.execute({ serviceTaskId: id });
      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }
      return ServiceTaskResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        tableSessionId: result.value.tableSessionId,
        type: result.value.type,
        status: result.value.status,
        assignedTo: result.value.assignedTo,
        notes: result.value.notes,
        createdAt: result.value.createdAt.toISOString(),
        assignedAt: result.value.assignedAt?.toISOString() ?? null,
        startedAt: result.value.startedAt?.toISOString() ?? null,
        completedAt: result.value.completedAt?.toISOString() ?? null,
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/service/tasks/:id/complete
  app.patch(
    '/tasks/:id/complete',
    {
      preHandler: [
        requirePermission(Permission.SERVICE_TASKS_MANAGE),
        requireResourceAccess('service-task'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await completeUseCase.execute({ serviceTaskId: id });
      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }
      return ServiceTaskResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        tableSessionId: result.value.tableSessionId,
        type: result.value.type,
        status: result.value.status,
        assignedTo: result.value.assignedTo,
        notes: result.value.notes,
        createdAt: result.value.createdAt.toISOString(),
        assignedAt: result.value.assignedAt?.toISOString() ?? null,
        startedAt: result.value.startedAt?.toISOString() ?? null,
        completedAt: result.value.completedAt?.toISOString() ?? null,
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/service/tasks/:id/cancel
  app.patch(
    '/tasks/:id/cancel',
    {
      preHandler: [
        requirePermission(Permission.SERVICE_TASKS_MANAGE),
        requireResourceAccess('service-task'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await cancelUseCase.execute({ serviceTaskId: id });
      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }
      return ServiceTaskResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        tableSessionId: result.value.tableSessionId,
        type: result.value.type,
        status: result.value.status,
        assignedTo: result.value.assignedTo,
        notes: result.value.notes,
        createdAt: result.value.createdAt.toISOString(),
        assignedAt: result.value.assignedAt?.toISOString() ?? null,
        startedAt: result.value.startedAt?.toISOString() ?? null,
        completedAt: result.value.completedAt?.toISOString() ?? null,
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );
}
