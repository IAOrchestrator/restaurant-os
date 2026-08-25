import { FastifyPluginAsync } from 'fastify';
import { GetLiveOperationsUseCase } from '@restaurant-os/application';
import {
  PrismaTableRepository,
  PrismaTableSessionRepository,
  PrismaWaitlistRepository,
  PrismaKitchenOrderRepository,
  PrismaAccountRepository,
  PrismaServiceTaskRepository,
  PrismaOrderRepository,
  PrismaRawMaterialRepository,
  requirePermission,
  requireAnyPermission,
  validateRestaurantAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  const tableRepo = new PrismaTableRepository();
  const sessionRepo = new PrismaTableSessionRepository();
  const waitlistRepo = new PrismaWaitlistRepository();
  const kitchenRepo = new PrismaKitchenOrderRepository();
  const accountRepo = new PrismaAccountRepository();
  const taskRepo = new PrismaServiceTaskRepository();
  const orderRepo = new PrismaOrderRepository();
  const rawMaterialRepo = new PrismaRawMaterialRepository();

  const getLiveOperations = new GetLiveOperationsUseCase(
    tableRepo,
    sessionRepo,
    waitlistRepo,
    kitchenRepo,
    accountRepo,
    taskRepo,
    orderRepo,
    rawMaterialRepo,
  );

  fastify.get(
    '/live-operations',
    {
      preHandler: [
        requirePermission(Permission.ANALYTICS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId is required' });
      }

      try {
        const report = await getLiveOperations.execute(restaurantId);
        return reply.send(report);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message || 'Internal server error' });
      }
    },
  );

  // GET /api/analytics/live-qrs?restaurantId=...
  fastify.get(
    '/live-qrs',
    {
      preHandler: [
        requireAnyPermission(
          Permission.ANALYTICS_READ,
          Permission.PREORDERS_READ,
          Permission.ORDERS_READ,
          Permission.ACCOUNTS_READ,
        ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId } = request.query as { restaurantId?: string };
      if (!restaurantId) {
        return reply.status(400).send({ error: 'restaurantId is required' });
      }

      try {
        const { prisma } = await import('@restaurant-os/infrastructure');

        const [preOrders, orders, customers] = await Promise.all([
          prisma.preOrder.findMany({
            where: {
              restaurantId,
              status: { in: ['DRAFT', 'READY', 'REVIEWING'] },
            },
            include: { customer: true },
            orderBy: { updatedAt: 'desc' },
          }),
          prisma.order.findMany({
            where: {
              restaurantId,
              status: { in: ['DRAFT', 'CONFIRMED', 'SENT_TO_KITCHEN', 'READY'] },
            },
            include: { customer: true },
            orderBy: { updatedAt: 'desc' },
          }),
          prisma.customer.findMany(),
        ]);

        const customerMap = new Map<string, any>();
        customers.forEach((c) => customerMap.set(c.id, c));

        // Group by Customer to enforce 1 CLIENT = 1 UNIQUE LIVE QR (Latest decision)
        const liveQrByCustomer = new Map<string, any>();

        // 1. Process orders first (most current lifecycle)
        for (const ord of orders) {
          const custId = ord.customerId || `anon-${ord.id.slice(0, 6)}`;
          if (liveQrByCustomer.has(custId)) continue;

          const cust = ord.customerId ? customerMap.get(ord.customerId) : null;
          const itemsList: any[] = Array.isArray(ord.items)
            ? (ord.items as any[])
            : typeof ord.items === 'string'
            ? JSON.parse(ord.items || '[]')
            : [];

          const total = itemsList.reduce(
            (sum: number, it: any) => sum + (Number(it.unitPrice) || 8000) * (Number(it.quantity) || 1),
            0,
          );

          let channel: 'SALON' | 'TAKEAWAY' | 'DELIVERY' = 'SALON';
          let code = `#P-${ord.id.slice(0, 4).toUpperCase()}`;
          let location = 'Salón / Mesa';

          const isTakeaway = itemsList.some((it) => it.type === 'TAKEAWAY') || ord.id.includes('takeaway') || ord.id.includes('TA_');
          const isDelivery = itemsList.some((it) => it.type === 'DELIVERY') || ord.id.includes('delivery') || ord.id.includes('DEL_');

          if (isTakeaway) {
            channel = 'TAKEAWAY';
            code = `#L-${ord.id.slice(0, 2).toUpperCase()}`;
            location = 'Barra Mostrador';
          } else if (isDelivery) {
            channel = 'DELIVERY';
            code = `#D-${ord.id.slice(0, 2).toUpperCase()}`;
            location = 'Reparto Domicilio';
          }

          let statusText = '🟢 VIVO / ACTIVO';
          if (ord.status === 'SENT_TO_KITCHEN') statusText = '🟡 EN PREPARACIÓN (KDS)';
          if (ord.status === 'READY') statusText = isTakeaway ? '✨ LISTO EN BARRA' : '✨ LISTO';

          liveQrByCustomer.set(custId, {
            customerId: custId,
            customerName: cust?.name || `Cliente #${custId.slice(0, 6)}`,
            email: cust?.email || null,
            phone: cust?.phone || null,
            code,
            channel,
            location,
            status: statusText,
            totalAmount: total,
            updatedAt: ord.updatedAt.toISOString(),
          });
        }

        // 2. Process active pre-orders (if customer has no ongoing cooked order)
        for (const pre of preOrders) {
          const custId = pre.customerId || `anon-${pre.id.slice(0, 6)}`;
          if (liveQrByCustomer.has(custId)) continue;

          const cust = pre.customerId ? customerMap.get(pre.customerId) : null;
          const itemsList: any[] = Array.isArray(pre.items)
            ? (pre.items as any[])
            : typeof pre.items === 'string'
            ? JSON.parse(pre.items || '[]')
            : [];

          const total = itemsList.reduce(
            (sum: number, it: any) => sum + (Number(it.unitPrice) || 8000) * (Number(it.quantity) || 1),
            0,
          );

          liveQrByCustomer.set(custId, {
            customerId: custId,
            customerName: cust?.name || `Cliente #${custId.slice(0, 6)}`,
            email: cust?.email || null,
            phone: cust?.phone || null,
            code: `#P-${pre.id.slice(0, 4).toUpperCase()}`,
            channel: 'SALON',
            location: 'Puerta / Espera',
            status: '🟢 VIVO / ACTIVO',
            totalAmount: total,
            updatedAt: pre.updatedAt.toISOString(),
          });
        }

        return reply.send(Array.from(liveQrByCustomer.values()));
      } catch (err: any) {
        return reply.status(500).send({ error: err.message || 'Error fetching live QRs' });
      }
    },
  );
};
