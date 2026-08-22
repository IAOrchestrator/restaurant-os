import { Product, type ProductId } from '@restaurant-os/domain';
import type { ProductRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { ProductMapper } from './mappers/product-mapper';

export class PrismaProductRepository implements ProductRepository {
  async findById(id: ProductId): Promise<Product | null> {
    const prismaProduct = await prisma.product.findUnique({ where: { id } });
    if (!prismaProduct) return null;
    return ProductMapper.toDomain(prismaProduct);
  }

  async findByCategoryId(categoryId: string): Promise<Product[]> {
    const prismaProducts = await prisma.product.findMany({
      where: { categoryId },
      orderBy: { name: 'asc' },
    });
    return prismaProducts
      .map((p) => ProductMapper.toDomain(p))
      .filter((p): p is Product => p !== null);
  }

  async findByRestaurantId(restaurantId: string): Promise<Product[]> {
    const prismaProducts = await prisma.product.findMany({
      where: { restaurantId },
      orderBy: { name: 'asc' },
    });
    return prismaProducts
      .map((p) => ProductMapper.toDomain(p))
      .filter((p): p is Product => p !== null);
  }

  async findAvailableByRestaurantId(restaurantId: string): Promise<Product[]> {
    const prismaProducts = await prisma.product.findMany({
      where: { restaurantId, isAvailable: true },
      orderBy: { name: 'asc' },
    });
    return prismaProducts
      .map((p) => ProductMapper.toDomain(p))
      .filter((p): p is Product => p !== null);
  }

  async save(product: Product): Promise<void> {
    const data = ProductMapper.toPrisma(product);
    await prisma.product.upsert({
      where: { id: product.id },
      update: data as any,
      create: data as any,
    });
  }

  async delete(id: ProductId): Promise<void> {
    await prisma.product.delete({ where: { id } });
  }
}
