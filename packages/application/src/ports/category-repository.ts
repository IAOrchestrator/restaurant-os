import type { Category, CategoryId } from '@restaurant-os/domain';

export interface CategoryRepository {
  findById(id: CategoryId): Promise<Category | null>;
  findByRestaurantId(restaurantId: string): Promise<Category[]>;
  save(category: Category): Promise<void>;
  delete(id: CategoryId): Promise<void>;
}
