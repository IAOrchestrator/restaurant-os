import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CustomerResponseSchema,
} from '@restaurant-os/contracts';
import {
  CreateCustomerUseCase,
  GetCustomerUseCase,
  UpdateCustomerProfileUseCase,
  type CustomerRepository,
} from '@restaurant-os/application';
import { Permission } from '@restaurant-os/domain';

export interface CustomerRoutesOptions {
  customerRepo: CustomerRepository;
}

export async function customerRoutes(
  app: FastifyInstance,
  opts: CustomerRoutesOptions,
) {
  const createUseCase = new CreateCustomerUseCase(opts.customerRepo);
  const getUseCase = new GetCustomerUseCase(opts.customerRepo);
  const updateUseCase = new UpdateCustomerProfileUseCase(opts.customerRepo);

  const formatCustomer = (c: any) =>
    CustomerResponseSchema.parse({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    });

  // POST /api/customers (Public registration for mobile diners)
  app.post(
    '/',
    async (request, reply) => {
      const parsed = CreateCustomerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      try {
        const customer = await createUseCase.execute({
          id: parsed.data.id ?? randomUUID(),
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
        });
        return reply.status(201).send(formatCustomer(customer));
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  // GET /api/customers/:id (Staff with CUSTOMER_MANAGE or self-customer)
  app.get(
    '/:id',
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const isSelf = request.actor?.isCustomer() && request.actor.id === id && id !== 'anonymous';
      let isStaffAllowed = false;
      if (request.actor?.isStaff()) {
        const checker = request.permissionChecker;
        isStaffAllowed = Boolean(checker && (await checker.hasPermission(request.actor, Permission.CUSTOMER_MANAGE)));
      }

      if (!isSelf && !isStaffAllowed && !request.actor?.isSystem()) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Forbidden: requires customer.manage or ownership' });
      }

      const customer = await getUseCase.execute(id);
      if (!customer) {
        return reply.status(404).send({ error: 'Customer not found' });
      }
      return formatCustomer(customer);
    },
  );

  // PATCH /api/customers/:id (Staff with CUSTOMER_MANAGE or self-customer)
  app.patch(
    '/:id',
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const isSelf = request.actor?.isCustomer() && request.actor.id === id && id !== 'anonymous';
      let isStaffAllowed = false;
      if (request.actor?.isStaff()) {
        const checker = request.permissionChecker;
        isStaffAllowed = Boolean(checker && (await checker.hasPermission(request.actor, Permission.CUSTOMER_MANAGE)));
      }

      if (!isSelf && !isStaffAllowed && !request.actor?.isSystem()) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Forbidden: requires customer.manage or ownership' });
      }

      const parsed = UpdateCustomerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      try {
        const updated = await updateUseCase.execute({
          id,
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
        });
        return formatCustomer(updated);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );
}
