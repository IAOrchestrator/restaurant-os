import { Order, type OrderId } from '@restaurant-os/domain';
import type { OrderRepository } from '@restaurant-os/application';
import { PrismaClient, Prisma } from '@restaurant-os/database';
import { prisma } from './prisma-client';
import { OrderMapper } from './mappers/order-mapper';

export class PrismaOrderRepository implements OrderRepository {
  constructor(
    private readonly db: PrismaClient | Prisma.TransactionClient = prisma,
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    const prismaOrder = await this.db.order.findUnique({ where: { id } });
    if (!prismaOrder) return null;
    return OrderMapper.toDomain(prismaOrder);
  }

  async findByTableSessionId(tableSessionId: string): Promise<Order[]> {
    const prismaOrders = await this.db.order.findMany({
      where: { tableSessionId },
      orderBy: { createdAt: 'desc' },
    });
    return prismaOrders
      .map((o) => OrderMapper.toDomain(o))
      .filter((o): o is Order => o !== null);
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    const prismaOrders = await this.db.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
    return prismaOrders
      .map((o) => OrderMapper.toDomain(o))
      .filter((o): o is Order => o !== null);
  }

  async save(order: Order): Promise<void> {
    const data = OrderMapper.toPrisma(order);
    if (order.customerId) {
      try {
        await (this.db as any).customer.upsert({
          where: { id: order.customerId },
          update: {},
          create: {
            id: order.customerId,
            name: `Cliente #${order.customerId.slice(0, 6)}`,
          },
        });
      } catch {
        // Continue
      }
    }
    await this.db.order.upsert({
      where: { id: order.id },
      update: data as any,
      create: data as any,
    });
  }

  async delete(id: OrderId): Promise<void> {
    await this.db.order.delete({ where: { id } });
  }
}
