import { Order, type OrderId } from '@restaurant-os/domain';
import type { OrderRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { OrderMapper } from './mappers/order-mapper';

export class PrismaOrderRepository implements OrderRepository {
  async findById(id: OrderId): Promise<Order | null> {
    const prismaOrder = await prisma.order.findUnique({ where: { id } });
    if (!prismaOrder) return null;
    return OrderMapper.toDomain(prismaOrder);
  }

  async findByTableSessionId(tableSessionId: string): Promise<Order[]> {
    const prismaOrders = await prisma.order.findMany({
      where: { tableSessionId },
      orderBy: { createdAt: 'desc' },
    });
    return prismaOrders
      .map((o) => OrderMapper.toDomain(o))
      .filter((o): o is Order => o !== null);
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    const prismaOrders = await prisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
    return prismaOrders
      .map((o) => OrderMapper.toDomain(o))
      .filter((o): o is Order => o !== null);
  }

  async save(order: Order): Promise<void> {
    const data = OrderMapper.toPrisma(order);
    await prisma.order.upsert({
      where: { id: order.id },
      update: data as any,
      create: data as any,
    });
  }

  async delete(id: OrderId): Promise<void> {
    await prisma.order.delete({ where: { id } });
  }
}
