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
  CreateAccountSchema,
  AccountResponseSchema,
  AddOrderToAccountSchema,
  RegisterPaymentSchema,
} from '@restaurant-os/contracts';
import {
  CreateAccountUseCase,
  AddOrderToAccountUseCase,
  RequestPaymentUseCase,
  RegisterPaymentUseCase,
  CloseAccountUseCase,
  type AccountRepository,
  type OrderRepository,
  type EventPublisher,
} from '@restaurant-os/application';

interface PaymentLike {
  id: string;
  amount: number;
  method: string;
  registeredAt: Date;
}

export interface BillingRoutesOptions {
  accountRepo: AccountRepository;
  orderRepo: OrderRepository;
  eventPublisher: EventPublisher;
}

export async function billingRoutes(app: FastifyInstance, opts: BillingRoutesOptions) {
  const createUseCase = new CreateAccountUseCase(opts.accountRepo, opts.eventPublisher);
  const addOrderUseCase = new AddOrderToAccountUseCase(
    opts.accountRepo,
    opts.orderRepo,
    opts.eventPublisher,
  );
  const requestPaymentUseCase = new RequestPaymentUseCase(opts.accountRepo, opts.eventPublisher);
  const registerPaymentUseCase = new RegisterPaymentUseCase(opts.accountRepo, opts.eventPublisher);
  const closeUseCase = new CloseAccountUseCase(opts.accountRepo, opts.eventPublisher);

  // POST /api/billing/accounts
  app.post(
    '/accounts',
    {
      preHandler: [
        requireAnyPermission(Permission.ACCOUNTS_READ, Permission.TABLE_SESSIONS_MANAGE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await createUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        restaurantId: parsed.data.restaurantId,
        tableSessionId: parsed.data.tableSessionId,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(
        AccountResponseSchema.parse({
          id: result.value.id,
          restaurantId: result.value.restaurantId,
          tableSessionId: result.value.tableSessionId,
          status: result.value.status,
          totalAmount: result.value.totalAmount,
          paidAmount: result.value.paidAmount,
          remainingAmount: result.value.remainingAmount,
          isFullyPaid: result.value.isFullyPaid,
          payments: result.value.payments.map((p: PaymentLike) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            registeredAt: p.registeredAt.toISOString(),
          })),
          createdAt: result.value.createdAt.toISOString(),
          updatedAt: result.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/billing/accounts?restaurantId=...
  app.get(
    '/accounts',
    {
      preHandler: [
        requirePermission(Permission.ACCOUNTS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId query param is required' });
      }

      const accounts = await opts.accountRepo.findByRestaurantId(restaurantId);
      return accounts.map((a) =>
        AccountResponseSchema.parse({
          id: a.id,
          restaurantId: a.restaurantId,
          tableSessionId: a.tableSessionId,
          status: a.status,
          totalAmount: a.totalAmount,
          paidAmount: a.paidAmount,
          remainingAmount: a.remainingAmount,
          isFullyPaid: a.isFullyPaid,
          payments: a.payments.map((p: PaymentLike) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            registeredAt: p.registeredAt.toISOString(),
          })),
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/billing/accounts/:id
  app.get(
    '/accounts/:id',
    {
      preHandler: [
        requirePermission(Permission.ACCOUNTS_READ),
        requireResourceAccess('account'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const account = await opts.accountRepo.findById(id);
      if (!account) {
        return reply.status(404).send({ error: 'Account not found' });
      }
      return AccountResponseSchema.parse({
        id: account.id,
        restaurantId: account.restaurantId,
        tableSessionId: account.tableSessionId,
        status: account.status,
        totalAmount: account.totalAmount,
        paidAmount: account.paidAmount,
        remainingAmount: account.remainingAmount,
        isFullyPaid: account.isFullyPaid,
        payments: account.payments.map((p: PaymentLike) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          registeredAt: p.registeredAt.toISOString(),
        })),
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      });
    },
  );

  // POST /api/billing/accounts/:id/orders
  app.post(
    '/accounts/:id/orders',
    {
      preHandler: [
        requireAnyPermission(Permission.ORDERS_CREATE, Permission.ACCOUNTS_READ),
        requireResourceAccess('account'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = AddOrderToAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await addOrderUseCase.execute({
        accountId: id,
        orderId: parsed.data.orderId,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return AccountResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        tableSessionId: result.value.tableSessionId,
        status: result.value.status,
        totalAmount: result.value.totalAmount,
        paidAmount: result.value.paidAmount,
        remainingAmount: result.value.remainingAmount,
        isFullyPaid: result.value.isFullyPaid,
        payments: result.value.payments.map((p: PaymentLike) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          registeredAt: p.registeredAt.toISOString(),
        })),
        createdAt: result.value.createdAt.toISOString(),
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );

  // Handler: request-payment
  const requestPaymentHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await requestPaymentUseCase.execute({ accountId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return AccountResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      tableSessionId: result.value.tableSessionId,
      status: result.value.status,
      totalAmount: result.value.totalAmount,
      paidAmount: result.value.paidAmount,
      remainingAmount: result.value.remainingAmount,
      isFullyPaid: result.value.isFullyPaid,
      payments: result.value.payments.map((p: PaymentLike) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        registeredAt: p.registeredAt.toISOString(),
      })),
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/accounts/:id/request-payment', { preHandler: [requirePermission(Permission.ACCOUNTS_REQUEST_PAYMENT), requireResourceAccess('account')] }, requestPaymentHandler);
  app.patch('/accounts/:id/request-payment', { preHandler: [requirePermission(Permission.ACCOUNTS_REQUEST_PAYMENT), requireResourceAccess('account')] }, requestPaymentHandler);

  // POST /api/billing/accounts/:id/payments
  app.post(
    '/accounts/:id/payments',
    {
      preHandler: [
        requirePermission(Permission.PAYMENTS_REGISTER),
        requireResourceAccess('account'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = RegisterPaymentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await registerPaymentUseCase.execute({
        accountId: id,
        paymentId: parsed.data.paymentId ?? randomUUID(),
        amount: parsed.data.amount,
        method: parsed.data.method,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return AccountResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        tableSessionId: result.value.tableSessionId,
        status: result.value.status,
        totalAmount: result.value.totalAmount,
        paidAmount: result.value.paidAmount,
        remainingAmount: result.value.remainingAmount,
        isFullyPaid: result.value.isFullyPaid,
        payments: result.value.payments.map((p: PaymentLike) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          registeredAt: p.registeredAt.toISOString(),
        })),
        createdAt: result.value.createdAt.toISOString(),
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );

  // Handler: close account
  const closeAccountHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const result = await closeUseCase.execute({ accountId: id });
    if (!result.success) {
      return reply.status(400).send({ error: result.error.message });
    }
    return AccountResponseSchema.parse({
      id: result.value.id,
      restaurantId: result.value.restaurantId,
      tableSessionId: result.value.tableSessionId,
      status: result.value.status,
      totalAmount: result.value.totalAmount,
      paidAmount: result.value.paidAmount,
      remainingAmount: result.value.remainingAmount,
      isFullyPaid: result.value.isFullyPaid,
      payments: result.value.payments.map((p: PaymentLike) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        registeredAt: p.registeredAt.toISOString(),
      })),
      createdAt: result.value.createdAt.toISOString(),
      updatedAt: result.value.updatedAt.toISOString(),
    });
  };
  app.post('/accounts/:id/close', { preHandler: [requirePermission(Permission.ACCOUNTS_CLOSE), requireResourceAccess('account')] }, closeAccountHandler);
  app.patch('/accounts/:id/close', { preHandler: [requirePermission(Permission.ACCOUNTS_CLOSE), requireResourceAccess('account')] }, closeAccountHandler);
}
