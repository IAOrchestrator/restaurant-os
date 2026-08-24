import { KitchenOrder, type KitchenOrderId } from '@restaurant-os/domain';
import type { KitchenOrderRepository } from '@restaurant-os/application';
import { PrismaClient, Prisma } from '@restaurant-os/database';
import { prisma } from './prisma-client';
import { KitchenOrderMapper } from './mappers/kitchen-order-mapper';

export class PrismaKitchenOrderRepository implements KitchenOrderRepository {
  constructor(
    private readonly db: PrismaClient | Prisma.TransactionClient = prisma,
  ) {}

  async findById(id: KitchenOrderId): Promise<KitchenOrder | null> {
    const prismaOrder = await this.db.kitchenOrder.findUnique({ where: { id } });
    if (!prismaOrder) return null;
    return KitchenOrderMapper.toDomain(prismaOrder);
  }

  async findByOrderId(orderId: string): Promise<KitchenOrder | null> {
    const prismaOrder = await this.db.kitchenOrder.findUnique({ where: { orderId } });
    if (!prismaOrder) return null;
    return KitchenOrderMapper.toDomain(prismaOrder);
  }

  async findByRestaurantId(restaurantId: string, status?: string): Promise<KitchenOrder[]> {
    const where: Record<string, unknown> = { restaurantId };
    if (status) where.status = status;
    const prismaOrders = await this.db.kitchenOrder.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return prismaOrders
      .map((o) => KitchenOrderMapper.toDomain(o))
      .filter((o): o is KitchenOrder => o !== null);
  }

  async findByAssignedTo(staffId: string): Promise<KitchenOrder[]> {
    const prismaOrders = await this.db.kitchenOrder.findMany({
      where: { assignedTo: staffId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return prismaOrders
      .map((o) => KitchenOrderMapper.toDomain(o))
      .filter((o): o is KitchenOrder => o !== null);
  }

  async save(kitchenOrder: KitchenOrder): Promise<void> {
    const data = KitchenOrderMapper.toPrisma(kitchenOrder);
    await this.db.kitchenOrder.upsert({
      where: { id: kitchenOrder.id },
      update: data as any,
      create: data as any,
    });
  }

  async delete(id: KitchenOrderId): Promise<void> {
    await this.db.kitchenOrder.delete({ where: { id } });
  }
}
