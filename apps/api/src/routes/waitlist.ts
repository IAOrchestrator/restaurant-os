import { FastifyInstance } from 'fastify';
import {
  requirePermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';
import {
  JoinWaitlistSchema,
  WaitlistEntryResponseSchema,
} from '@restaurant-os/contracts';
import {
  JoinWaitlistUseCase,
  CallCustomerUseCase,
  ConfirmCustomerUseCase,
  CancelWaitlistUseCase,
  SelectTakeawayUseCase,
  SeatCustomerUseCase,
  type WaitlistRepository,
  type EventPublisher,
} from '@restaurant-os/application';

export interface WaitlistRoutesOptions {
  waitlistRepo: WaitlistRepository;
  eventPublisher: EventPublisher;
}

export async function waitlistRoutes(app: FastifyInstance, opts: WaitlistRoutesOptions) {
  const joinUseCase = new JoinWaitlistUseCase(opts.waitlistRepo, opts.eventPublisher);
  const callUseCase = new CallCustomerUseCase(opts.waitlistRepo, opts.eventPublisher);
  const confirmUseCase = new ConfirmCustomerUseCase(opts.waitlistRepo, opts.eventPublisher);
  const cancelUseCase = new CancelWaitlistUseCase(opts.waitlistRepo, opts.eventPublisher);
  const takeawayUseCase = new SelectTakeawayUseCase(opts.waitlistRepo, opts.eventPublisher);
  const seatUseCase = new SeatCustomerUseCase(opts.waitlistRepo, opts.eventPublisher);

  // POST /api/waitlist
  app.post(
    '/',
    {
      preHandler: [
        requirePermission(Permission.WAITLIST_MANAGE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = JoinWaitlistSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await joinUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        restaurantId: parsed.data.restaurantId,
        customerId: parsed.data.customerId ?? randomUUID(),
        partySize: parsed.data.partySize,
        preOrderId: parsed.data.preOrderId ?? null,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(
        WaitlistEntryResponseSchema.parse({
          id: result.value.id,
          restaurantId: result.value.restaurantId,
          customerId: result.value.customerId,
          partySize: result.value.partySize,
          status: result.value.status,
          enteredAt: result.value.enteredAt.toISOString(),
          calledAt: result.value.calledAt?.toISOString() ?? null,
          seatedAt: result.value.seatedAt?.toISOString() ?? null,
          cancelledAt: result.value.cancelledAt?.toISOString() ?? null,
          preOrderId: result.value.preOrderId,
          createdAt: result.value.createdAt.toISOString(),
          updatedAt: result.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/waitlist?restaurantId=...
  app.get(
    '/',
    {
      preHandler: [
        requirePermission(Permission.WAITLIST_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const entries = await opts.waitlistRepo.findByRestaurantId(restaurantId);
      return entries.map((e) =>
        WaitlistEntryResponseSchema.parse({
          id: e.id,
          restaurantId: e.restaurantId,
          customerId: e.customerId,
          partySize: e.partySize,
          status: e.status,
          enteredAt: e.enteredAt.toISOString(),
          calledAt: e.calledAt?.toISOString() ?? null,
          seatedAt: e.seatedAt?.toISOString() ?? null,
          cancelledAt: e.cancelledAt?.toISOString() ?? null,
          preOrderId: e.preOrderId,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/waitlist/:id
  app.get(
    '/:id',
    {
      preHandler: [
        requirePermission(Permission.WAITLIST_READ),
        requireResourceAccess('waitlist'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const entry = await opts.waitlistRepo.findById(id);
      if (!entry) {
        return reply.status(404).send({ error: 'Waitlist entry not found' });
      }
      return WaitlistEntryResponseSchema.parse({
        id: entry.id,
        restaurantId: entry.restaurantId,
        customerId: entry.customerId,
        partySize: entry.partySize,
        status: entry.status,
        enteredAt: entry.enteredAt.toISOString(),
        calledAt: entry.calledAt?.toISOString() ?? null,
        seatedAt: entry.seatedAt?.toISOString() ?? null,
        cancelledAt: entry.cancelledAt?.toISOString() ?? null,
        preOrderId: entry.preOrderId,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      });
    },
  );

  // Handler: /api/waitlist/:id/call
  const callHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await callUseCase.execute({ entryId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return WaitlistEntryResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      customerId: result.value.customerId,
      partySize: result.value.partySize,
      status: result.value.status,
      enteredAt: result.value.enteredAt.toISOString(),
      calledAt: result.value.calledAt?.toISOString() ?? null,
      seatedAt: result.value.seatedAt?.toISOString() ?? null,
      cancelledAt: result.value.cancelledAt?.toISOString() ?? null,
      preOrderId: result.value.preOrderId,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };

  app.post('/:id/call', { preHandler: [requirePermission(Permission.WAITLIST_MANAGE), requireResourceAccess('waitlist')] }, callHandler);
  app.patch('/:id/call', { preHandler: [requirePermission(Permission.WAITLIST_MANAGE), requireResourceAccess('waitlist')] }, callHandler);

  // Handler: /api/waitlist/:id/confirm
  const confirmHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await confirmUseCase.execute({ entryId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return WaitlistEntryResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      customerId: result.value.customerId,
      partySize: result.value.partySize,
      status: result.value.status,
      enteredAt: result.value.enteredAt.toISOString(),
      calledAt: result.value.calledAt?.toISOString() ?? null,
      seatedAt: result.value.seatedAt?.toISOString() ?? null,
      cancelledAt: result.value.cancelledAt?.toISOString() ?? null,
      preOrderId: result.value.preOrderId,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };

  app.post('/:id/confirm', { preHandler: [requirePermission(Permission.WAITLIST_MANAGE), requireResourceAccess('waitlist')] }, confirmHandler);
  app.patch('/:id/confirm', { preHandler: [requirePermission(Permission.WAITLIST_MANAGE), requireResourceAccess('waitlist')] }, confirmHandler);

  // Handler: /api/waitlist/:id/cancel
  const cancelHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await cancelUseCase.execute({ entryId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return WaitlistEntryResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      customerId: result.value.customerId,
      partySize: result.value.partySize,
      status: result.value.status,
      enteredAt: result.value.enteredAt.toISOString(),
      calledAt: result.value.calledAt?.toISOString() ?? null,
      seatedAt: result.value.seatedAt?.toISOString() ?? null,
      cancelledAt: result.value.cancelledAt?.toISOString() ?? null,
      preOrderId: result.value.preOrderId,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };

  app.post('/:id/cancel', { preHandler: [requirePermission(Permission.WAITLIST_MANAGE), requireResourceAccess('waitlist')] }, cancelHandler);
  app.patch('/:id/cancel', { preHandler: [requirePermission(Permission.WAITLIST_MANAGE), requireResourceAccess('waitlist')] }, cancelHandler);

  // Handler: /api/waitlist/:id/takeaway
  const takeawayHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await takeawayUseCase.execute({ entryId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return WaitlistEntryResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      customerId: result.value.customerId,
      partySize: result.value.partySize,
      status: result.value.status,
      enteredAt: result.value.enteredAt.toISOString(),
      calledAt: result.value.calledAt?.toISOString() ?? null,
      seatedAt: result.value.seatedAt?.toISOString() ?? null,
      cancelledAt: result.value.cancelledAt?.toISOString() ?? null,
      preOrderId: result.value.preOrderId,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };

  app.post('/:id/takeaway', { preHandler: [requirePermission(Permission.WAITLIST_MANAGE), requireResourceAccess('waitlist')] }, takeawayHandler);
  app.patch('/:id/takeaway', { preHandler: [requirePermission(Permission.WAITLIST_MANAGE), requireResourceAccess('waitlist')] }, takeawayHandler);

  // Handler: /api/waitlist/:id/seat
  const seatHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await seatUseCase.execute({ entryId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return WaitlistEntryResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      customerId: result.value.customerId,
      partySize: result.value.partySize,
      status: result.value.status,
      enteredAt: result.value.enteredAt.toISOString(),
      calledAt: result.value.calledAt?.toISOString() ?? null,
      seatedAt: result.value.seatedAt?.toISOString() ?? null,
      cancelledAt: result.value.cancelledAt?.toISOString() ?? null,
      preOrderId: result.value.preOrderId,
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };

  app.post('/:id/seat', { preHandler: [requirePermission(Permission.TABLES_OCCUPY), requireResourceAccess('waitlist')] }, seatHandler);
  app.patch('/:id/seat', { preHandler: [requirePermission(Permission.TABLES_OCCUPY), requireResourceAccess('waitlist')] }, seatHandler);
}
