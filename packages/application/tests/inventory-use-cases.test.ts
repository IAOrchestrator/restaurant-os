import { describe, it, expect, beforeEach } from 'vitest';
import { RawMaterial, Recipe } from '@restaurant-os/domain';
import {
  CreateRawMaterialUseCase,
  UpdateRawMaterialStockUseCase,
  ManageRecipeUseCase,
  DeductInventoryForOrderUseCase,
  RawMaterialRepository,
  RecipeRepository,
} from '../src';

class InMemoryRawMaterialRepository implements RawMaterialRepository {
  private items = new Map<string, RawMaterial>();

  async findById(id: string): Promise<RawMaterial | null> {
    return this.items.get(id) || null;
  }
  async findByRestaurantId(restaurantId: string): Promise<RawMaterial[]> {
    return Array.from(this.items.values()).filter((i) => i.restaurantId === restaurantId);
  }
  async findLowStockByRestaurantId(restaurantId: string): Promise<RawMaterial[]> {
    return Array.from(this.items.values()).filter((i) => i.restaurantId === restaurantId && i.isLowStock());
  }
  async save(rawMaterial: RawMaterial): Promise<void> {
    this.items.set(rawMaterial.id, rawMaterial);
  }
  async saveMany(rawMaterials: RawMaterial[]): Promise<void> {
    for (const r of rawMaterials) this.items.set(r.id, r);
  }
  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryRecipeRepository implements RecipeRepository {
  private recipes = new Map<string, Recipe>();

  async findByProductId(productId: string): Promise<Recipe | null> {
    return this.recipes.get(productId) || null;
  }
  async findByProductIds(productIds: string[]): Promise<Recipe[]> {
    return productIds.map((id) => this.recipes.get(id)).filter(Boolean) as Recipe[];
  }
  async save(recipe: Recipe): Promise<void> {
    this.recipes.set(recipe.productId, recipe);
  }
  async deleteByProductId(productId: string): Promise<void> {
    this.recipes.delete(productId);
  }
}

describe('Inventory & Recipe BOM Use Cases', () => {
  let rawMaterialRepo: InMemoryRawMaterialRepository;
  let recipeRepo: InMemoryRecipeRepository;
  const restaurantId = 'rest-123';

  beforeEach(() => {
    rawMaterialRepo = new InMemoryRawMaterialRepository();
    recipeRepo = new InMemoryRecipeRepository();
  });

  it('creates and restocks raw materials', async () => {
    const createUseCase = new CreateRawMaterialUseCase(rawMaterialRepo);
    const updateStockUseCase = new UpdateRawMaterialStockUseCase(rawMaterialRepo);

    const cheese = await createUseCase.execute({
      restaurantId,
      name: 'Queso Mozzarella',
      unit: 'KG',
      currentStock: 10,
      minStockAlert: 2,
      unitCost: 1500,
    });

    expect(cheese.id).toBeDefined();
    expect(cheese.currentStock).toBe(10);
    expect(cheese.isLowStock()).toBe(false);

    // Restock +5
    const restocked = await updateStockUseCase.execute({ id: cheese.id, adjustment: 5 });
    expect(restocked.currentStock).toBe(15);
  });

  it('configures recipe and deducts inventory on order', async () => {
    const createUseCase = new CreateRawMaterialUseCase(rawMaterialRepo);
    const manageRecipe = new ManageRecipeUseCase(recipeRepo);
    const deductUseCase = new DeductInventoryForOrderUseCase(rawMaterialRepo, recipeRepo);

    const flour = await createUseCase.execute({
      restaurantId,
      name: 'Harina 000',
      unit: 'KG',
      currentStock: 10,
      minStockAlert: 2,
      unitCost: 500,
    });

    const mozzarella = await createUseCase.execute({
      restaurantId,
      name: 'Queso Mozzarella',
      unit: 'KG',
      currentStock: 5,
      minStockAlert: 1.5,
      unitCost: 1500,
    });

    // Pizza Recipe: 0.25kg flour, 0.20kg mozzarella
    await manageRecipe.setRecipe({
      productId: 'pizza-muzzarella',
      ingredients: [
        { rawMaterialId: flour.id, quantity: 0.25 },
        { rawMaterialId: mozzarella.id, quantity: 0.2 },
      ],
    });

    // Order 4 pizzas
    const deductions = await deductUseCase.execute({
      restaurantId,
      orderId: 'order-1',
      items: [{ productId: 'pizza-muzzarella', quantity: 4 }],
    });

    expect(deductions.length).toBe(2);

    const flourAfter = await rawMaterialRepo.findById(flour.id);
    const mozAfter = await rawMaterialRepo.findById(mozzarella.id);

    // 10 - (0.25 * 4) = 9
    expect(flourAfter?.currentStock).toBe(9);
    // 5 - (0.20 * 4) = 4.2
    expect(mozAfter?.currentStock).toBe(4.2);
  });
});
