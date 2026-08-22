import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import {
  RegisterTableDeviceSchema,
  AssociateTableDeviceSchema,
  TableDeviceResponseSchema,
  TableSessionResponseSchema,
} from '@restaurant-os/contracts';
import {
  RegisterTableDeviceUseCase,
  AssociateTableDeviceUseCase,
  DisassociateTableDeviceUseCase,
  GetTableDeviceUseCase,
  ListTableDevicesUseCase,
  GetTableDeviceSessionUseCase,
  type TableDeviceRepository,
  type TableRepository,
  type TableSessionRepository,
  type EventPublisher,
} from '@restaurant-os/application';
import {
  requirePermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';

export interface TableDeviceRoutesOptions {
  deviceRepo: TableDeviceRepository;
  tableRepo: TableRepository;
  sessionRepo: TableSessionRepository;
  eventPublisher: EventPublisher;
}

export async function tableDeviceRoutes(
  app: FastifyInstance,
  opts: TableDeviceRoutesOptions,
) {
  const registerUseCase = new RegisterTableDeviceUseCase(opts.deviceRepo, opts.eventPublisher);
  const associateUseCase = new AssociateTableDeviceUseCase(opts.deviceRepo, opts.tableRepo, opts.eventPublisher);
  const disassociateUseCase = new DisassociateTableDeviceUseCase(opts.deviceRepo, opts.eventPublisher);
  const getUseCase = new GetTableDeviceUseCase(opts.deviceRepo);
  const listUseCase = new ListTableDevicesUseCase(opts.deviceRepo);
  const getSessionUseCase = new GetTableDeviceSessionUseCase(opts.deviceRepo, opts.sessionRepo);

  const formatDevice = (d: any) =>
    TableDeviceResponseSchema.parse({
      id: d.id,
      restaurantId: d.restaurantId,
      tableId: d.tableId ?? null,
      name: d.name,
      active: d.active,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    });

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

  // POST /api/table-devices
  app.post(
    '/',
    {
      preHandler: [
        requirePermission(Permission.TABLE_DEVICES_MANAGE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = RegisterTableDeviceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      try {
        const device = await registerUseCase.execute({
          id: parsed.data.id ?? randomUUID(),
          restaurantId: parsed.data.restaurantId,
          name: parsed.data.name,
          tableId: parsed.data.tableId ?? null,
        });
        return reply.status(201).send(formatDevice(device));
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  // GET /api/table-devices?restaurantId=...
  app.get(
    '/',
    {
      preHandler: [
        requirePermission(Permission.TABLE_DEVICES_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const devices = await listUseCase.execute(restaurantId);
      return devices.map((d) => formatDevice(d));
    },
  );

  // GET /api/table-devices/:id
  app.get(
    '/:id',
    {
      preHandler: [
        requirePermission(Permission.TABLE_DEVICES_READ),
        requireResourceAccess('table-device'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const device = await getUseCase.execute(id);
      if (!device) {
        return reply.status(404).send({ error: 'TableDevice not found' });
      }
      return formatDevice(device);
    },
  );

  // POST /api/table-devices/:id/associate
  app.post(
    '/:id/associate',
    {
      preHandler: [
        requirePermission(Permission.TABLE_DEVICES_MANAGE),
        requireResourceAccess('table-device'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = AssociateTableDeviceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      try {
        const device = await associateUseCase.execute({
          deviceId: id,
          tableId: parsed.data.tableId,
        });
        return formatDevice(device);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  // DELETE /api/table-devices/:id/associate
  app.delete(
    '/:id/associate',
    {
      preHandler: [
        requirePermission(Permission.TABLE_DEVICES_MANAGE),
        requireResourceAccess('table-device'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const device = await disassociateUseCase.execute({
          deviceId: id,
        });
        return formatDevice(device);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  // GET /api/table-devices/:id/session
  app.get(
    '/:id/session',
    {
      preHandler: [
        requireResourceAccess('table-device'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const session = await getSessionUseCase.execute(id);
        if (!session) {
          return reply.status(404).send({ error: 'No active TableSession found for device table' });
        }
        return formatSession(session);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );
}
