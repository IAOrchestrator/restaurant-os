import type { Product, ProductId } from '@restaurant-os/domain';

export interface ProductRepository {
  findById(id: ProductId): Promise<Product | null>;
  findByCategoryId(categoryId: string): Promise<Product[]>;
  findByRestaurantId(restaurantId: string): Promise<Product[]>;
  findAvailableByRestaurantId(restaurantId: string): Promise<Product[]>;
  save(product: Product): Promise<void>;
  delete(id: ProductId): Promise<void>;
}
