import { Product } from '@restaurant-os/domain';
import type { Product as PrismaProduct } from '@restaurant-os/database';

export class ProductMapper {
  static toDomain(prismaProduct: PrismaProduct): Product | null {
    const result = Product.create({
      id: prismaProduct.id,
      restaurantId: prismaProduct.restaurantId,
      categoryId: prismaProduct.categoryId,
      name: prismaProduct.name,
      description: prismaProduct.description,
      price: Number(prismaProduct.price),
      imageUrl: prismaProduct.imageUrl,
      isAvailable: prismaProduct.isAvailable,
      createdAt: prismaProduct.createdAt,
    });

    return result.success ? result.value : null;
  }

  static toPrisma(product: Product): Omit<PrismaProduct, 'restaurant' | 'category'> {
    return {
      id: product.id,
      restaurantId: product.restaurantId,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: product.price as any,
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      sortOrder: 0,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
