import { Recipe } from '@restaurant-os/domain';

export interface RecipeRepository {
  findByProductId(productId: string): Promise<Recipe | null>;
  findByProductIds(productIds: string[]): Promise<Recipe[]>;
  save(recipe: Recipe): Promise<void>;
  deleteByProductId(productId: string): Promise<void>;
}
