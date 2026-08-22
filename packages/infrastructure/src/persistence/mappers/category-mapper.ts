import { Category } from '@restaurant-os/domain';
import type { Category as PrismaCategory } from '@restaurant-os/database';

export class CategoryMapper {
  static toDomain(prismaCategory: PrismaCategory): Category | null {
    const result = Category.create({
      id: prismaCategory.id,
      restaurantId: prismaCategory.restaurantId,
      name: prismaCategory.name,
      description: prismaCategory.description,
      sortOrder: prismaCategory.sortOrder,
      createdAt: prismaCategory.createdAt,
    });

    if (!result.success) return null;
    let category = result.value;

    if (!prismaCategory.isActive) {
      category = category.deactivate();
    }

    return category;
  }

  static toPrisma(category: Category): Omit<PrismaCategory, 'restaurant' | 'products'> {
    return {
      id: category.id,
      restaurantId: category.restaurantId,
      name: category.name,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
