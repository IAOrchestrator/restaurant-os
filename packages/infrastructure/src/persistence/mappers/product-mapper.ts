import { Product } from '@restaurant-os/domain';
import type { Product as PrismaProduct } from '@restaurant-os/database';

export class ProductMapper {
  static toDomain(prismaProduct: PrismaProduct): Product | null {
    let sectorKDS = 'PIZZAS';
    let cleanDescription = prismaProduct.description;

    if (prismaProduct.description && prismaProduct.description.startsWith('[SECTOR:')) {
      const match = prismaProduct.description.match(/^\[SECTOR:([A-Z_]+)\]\s*(.*)$/s);
      if (match) {
        sectorKDS = match[1];
        cleanDescription = match[2] || null;
      }
    }

    const result = Product.create({
      id: prismaProduct.id,
      restaurantId: prismaProduct.restaurantId,
      categoryId: prismaProduct.categoryId,
      name: prismaProduct.name,
      description: cleanDescription,
      price: Number(prismaProduct.price),
      imageUrl: prismaProduct.imageUrl,
      isAvailable: prismaProduct.isAvailable,
      sectorKDS,
      createdAt: prismaProduct.createdAt,
    });

    return result.success ? result.value : null;
  }

  static toPrisma(product: Product): Omit<PrismaProduct, 'restaurant' | 'category'> {
    const desc = product.sectorKDS
      ? `[SECTOR:${product.sectorKDS}] ${product.description || ''}`.trim()
      : product.description;

    return {
      id: product.id,
      restaurantId: product.restaurantId,
      categoryId: product.categoryId,
      name: product.name,
      description: desc,
      price: product.price as any,
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      sortOrder: 0,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
