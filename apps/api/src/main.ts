import fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig } from '@restaurant-os/config';
import { StaffRole } from '@restaurant-os/domain';
import {
  RoleBasedPermissionChecker,
  OperationalResourceScoper,
} from '@restaurant-os/application';
import {
  prisma,
  PrismaTableRepository,
  PrismaTableSessionRepository,
  PrismaWaitlistRepository,
  PrismaPreOrderRepository,
  PrismaOrderRepository,
  PrismaAccountRepository,
  PrismaCategoryRepository,
  PrismaProductRepository,
  PrismaCustomerRepository,
  PrismaTableDeviceRepository,
  PrismaReviewRepository,
  PrismaEventLogRepository,
  PrismaKitchenOrderRepository,
  PrismaServiceTaskRepository,
  PrismaTransactionRunner,
  PersistingEventPublisher,
  EventBroadcaster,
  SseEventPublisher,
  setupAuth,
  Argon2PasswordHasher,
} from '@restaurant-os/infrastructure';
import { healthRoutes } from './routes/health';
import { versionRoutes } from './routes/version';
import { tableRoutes } from './routes/tables';
import { tableSessionRoutes } from './routes/table-sessions';
import { tableDeviceRoutes } from './routes/table-devices';
import { waitlistRoutes } from './routes/waitlist';
import { preOrderRoutes } from './routes/preorders';
import { orderRoutes } from './routes/orders';
import { billingRoutes } from './routes/billing';
import { catalogRoutes } from './routes/catalog';
import { customerRoutes } from './routes/customers';
import { reviewRoutes } from './routes/reviews';
import { eventRoutes } from './routes/events';
import { sseRoutes } from './routes/sse';
import { kitchenRoutes } from './routes/kitchen';
import { serviceRoutes } from './routes/service';
import { staffRoutes } from './routes/staff';
import { authRoutes } from './routes/auth';
import { analyticsRoutes } from './routes/analytics';
import { inventoryRoutes } from './routes/inventory';
import { JwtService } from '@restaurant-os/infrastructure';

async function bootstrap() {
  const config = loadConfig();
  const app = fastify({ logger: true });

  await app.register(cors, { origin: true });

  // Root endpoint for Render health checks
  app.get('/', async () => ({ status: 'ok', name: 'Restaurant OS API', version: '0.1.0' }));
  app.head('/', async (_req, reply) => reply.status(200).send());

  // Resolvers for Auth & Scoper
  const getStaffRoles = async (staffId: string): Promise<StaffRole[]> => {
    const assignments = await prisma.staffRoleAssignment.findMany({
      where: { staffId },
      select: { role: true },
    });
    return assignments.map((a: { role: string }) => a.role as StaffRole);
  };

  const getWaiterTableSessionIds = async (waiterId: string): Promise<string[]> => {
    const sessions = await prisma.tableSession.findMany({
      where: { status: { not: 'CLOSED' } },
    });
    return sessions
      .filter((s: { id: string; waiterAssignments: string | null }) => {
        if (!s.waiterAssignments) return false;
        try {
          const parsed = JSON.parse(s.waiterAssignments);
          return parsed.some((w: { waiterId: string; replacedAt?: string }) => w.waiterId === waiterId && !w.replacedAt);
        } catch {
          return false;
        }
      })
      .map((s: { id: string }) => s.id);
  };

  const getTableDeviceSessionId = async (tableDeviceId: string): Promise<string | null> => {
    const device = await prisma.tableDevice.findUnique({
      where: { id: tableDeviceId },
      select: { tableId: true },
    });
    if (!device || !device.tableId) return null;
    const activeSession = await prisma.tableSession.findFirst({
      where: { tableId: device.tableId, status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return activeSession?.id ?? null;
  };

  const getTableDeviceTableId = async (tableDeviceId: string): Promise<string | null> => {
    const device = await prisma.tableDevice.findUnique({
      where: { id: tableDeviceId },
      select: { tableId: true },
    });
    return device?.tableId ?? null;
  };

  const getCustomerSessionIds = async (customerId: string): Promise<string[]> => {
    const sessions = await prisma.tableSession.findMany({
      where: { status: { not: 'CLOSED' } },
      select: { id: true, customerIds: true },
    });
    return sessions
      .filter((s: { id: string; customerIds: string | null }) => {
        if (!s.customerIds) return false;
        try {
          const parsed = JSON.parse(s.customerIds);
          return Array.isArray(parsed) && parsed.includes(customerId);
        } catch {
          return false;
        }
      })
      .map((s: { id: string }) => s.id);
  };

  const permissionChecker = new RoleBasedPermissionChecker(getStaffRoles);
  const resourceScoper = new OperationalResourceScoper(
    getWaiterTableSessionIds,
    getTableDeviceSessionId,
    getStaffRoles,
    getTableDeviceTableId,
    getCustomerSessionIds,
  );

  const jwtService = new JwtService(config.jwtSecret);

  // Setup authentication & authorization hooks
  setupAuth(app, {
    permissionChecker,
    resourceScoper,
    jwtService,
  });

  // Infrastructure instances (DI container)
  const tableRepo = new PrismaTableRepository();
  const sessionRepo = new PrismaTableSessionRepository();
  const waitlistRepo = new PrismaWaitlistRepository();
  const preOrderRepo = new PrismaPreOrderRepository();
  const orderRepo = new PrismaOrderRepository();
  const accountRepo = new PrismaAccountRepository();
  const categoryRepo = new PrismaCategoryRepository();
  const productRepo = new PrismaProductRepository();
  const customerRepo = new PrismaCustomerRepository();
  const tableDeviceRepo = new PrismaTableDeviceRepository();
  const reviewRepo = new PrismaReviewRepository();
  const eventLogRepo = new PrismaEventLogRepository();
  const kitchenOrderRepo = new PrismaKitchenOrderRepository();
  const serviceTaskRepo = new PrismaServiceTaskRepository();
  const broadcaster = new EventBroadcaster();
  const txRunner = new PrismaTransactionRunner();
  const eventPublisher = new PersistingEventPublisher(
    eventLogRepo,
    new SseEventPublisher(broadcaster),
  );

  const credentialHasher = new Argon2PasswordHasher();

  // Register routes with their dependencies
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(versionRoutes, { prefix: '/version' });
  await app.register(authRoutes, { prefix: '/api/auth', jwtService, credentialHasher });
  await app.register(tableRoutes, { prefix: '/api/tables', tableRepo, sessionRepo, eventPublisher });
  await app.register(tableSessionRoutes, { prefix: '/api/table-sessions', tableRepo, sessionRepo, eventPublisher, txRunner });
  await app.register(tableDeviceRoutes, { prefix: '/api/table-devices', deviceRepo: tableDeviceRepo, tableRepo, sessionRepo, eventPublisher });
  await app.register(waitlistRoutes, { prefix: '/api/waitlist', waitlistRepo, eventPublisher });
  await app.register(preOrderRoutes, { prefix: '/api/preorders', preOrderRepo, eventPublisher });
  await app.register(orderRoutes, {
    prefix: '/api/orders',
    orderRepo,
    preOrderRepo,
    kitchenOrderRepo,
    sessionRepo,
    tableRepo,
    eventPublisher,
    txRunner,
    productRepo,
  });
  await app.register(billingRoutes, {
    prefix: '/api/billing',
    accountRepo,
    orderRepo,
    kitchenOrderRepo,
    sessionRepo,
    tableRepo,
    eventPublisher,
    txRunner,
    productRepo,
  });
  await app.register(catalogRoutes, { prefix: '/api/catalog', categoryRepo, productRepo, eventPublisher });
  await app.register(customerRoutes, { prefix: '/api/customers', customerRepo });
  await app.register(reviewRoutes, { prefix: '/api/reviews', reviewRepo, eventPublisher });
  await app.register(eventRoutes, { prefix: '/api/events', eventLogRepo });
  await app.register(sseRoutes, { prefix: '/api/events', broadcaster, jwtService });
  await app.register(kitchenRoutes, {
    prefix: '/api/kitchen',
    kitchenOrderRepo,
    orderRepo,
    sessionRepo,
    tableRepo,
    eventPublisher,
    txRunner,
  });
  await app.register(serviceRoutes, { prefix: '/api/service', serviceTaskRepo, eventPublisher });
  await app.register(staffRoutes, { prefix: '/api/staff' });
  await app.register(analyticsRoutes, { prefix: '/api/analytics' });
  await app.register(inventoryRoutes, { prefix: '/api/inventory' });

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Restaurant OS API v${config.apiVersion} running on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
