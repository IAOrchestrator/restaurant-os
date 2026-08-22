import { Category, type CategoryId } from '@restaurant-os/domain';
import type { CategoryRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { CategoryMapper } from './mappers/category-mapper';

export class PrismaCategoryRepository implements CategoryRepository {
  async findById(id: CategoryId): Promise<Category | null> {
    const prismaCategory = await prisma.category.findUnique({ where: { id } });
    if (!prismaCategory) return null;
    return CategoryMapper.toDomain(prismaCategory);
  }

  async findByRestaurantId(restaurantId: string): Promise<Category[]> {
    const prismaCategories = await prisma.category.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
    });
    return prismaCategories
      .map((c) => CategoryMapper.toDomain(c))
      .filter((c): c is Category => c !== null);
  }

  async save(category: Category): Promise<void> {
    const data = CategoryMapper.toPrisma(category);
    await prisma.category.upsert({
      where: { id: category.id },
      update: data as any,
      create: data as any,
    });
  }

  async delete(id: CategoryId): Promise<void> {
    await prisma.category.delete({ where: { id } });
  }
}
