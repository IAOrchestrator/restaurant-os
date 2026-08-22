import { PreOrder, type PreOrderId } from '@restaurant-os/domain';
import type { PreOrderRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { PreOrderMapper } from './mappers/preorder-mapper';

export class PrismaPreOrderRepository implements PreOrderRepository {
  async findById(id: PreOrderId): Promise<PreOrder | null> {
    const prismaPreOrder = await prisma.preOrder.findUnique({ where: { id } });
    if (!prismaPreOrder) return null;
    return PreOrderMapper.toDomain(prismaPreOrder);
  }

  async findByCustomerId(customerId: string): Promise<PreOrder[]> {
    const prismaPreOrders = await prisma.preOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return prismaPreOrders
      .map((p) => PreOrderMapper.toDomain(p))
      .filter((p): p is PreOrder => p !== null);
  }

  async findByRestaurantId(restaurantId: string): Promise<PreOrder[]> {
    const prismaPreOrders = await prisma.preOrder.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
    return prismaPreOrders
      .map((p) => PreOrderMapper.toDomain(p))
      .filter((p): p is PreOrder => p !== null);
  }

  async save(preOrder: PreOrder): Promise<void> {
    const data = PreOrderMapper.toPrisma(preOrder);
    await prisma.preOrder.upsert({
      where: { id: preOrder.id },
      update: data as any,
      create: data as any,
    });
  }

  async delete(id: PreOrderId): Promise<void> {
    await prisma.preOrder.delete({ where: { id } });
  }
}
