import { Recipe, RecipeIngredient } from '@restaurant-os/domain';
import { RecipeRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';

export class PrismaRecipeRepository implements RecipeRepository {
  async findByProductId(productId: string): Promise<Recipe | null> {
    const items = await prisma.recipeItem.findMany({
      where: { productId },
      include: { rawMaterial: true },
    });

    if (items.length === 0) return null;

    const ingredients: RecipeIngredient[] = items.map((item) => ({
      rawMaterialId: item.rawMaterialId,
      rawMaterialName: item.rawMaterial?.name,
      unit: item.rawMaterial?.unit,
      quantity: Number(item.quantity),
    }));

    return new Recipe({
      id: `recipe-${productId}`,
      productId,
      ingredients,
      createdAt: items[0].createdAt,
      updatedAt: items[0].updatedAt,
    });
  }

  async findByProductIds(productIds: string[]): Promise<Recipe[]> {
    if (productIds.length === 0) return [];
    const items = await prisma.recipeItem.findMany({
      where: { productId: { in: productIds } },
      include: { rawMaterial: true },
    });

    const byProduct: Record<string, RecipeIngredient[]> = {};
    for (const item of items) {
      if (!byProduct[item.productId]) byProduct[item.productId] = [];
      byProduct[item.productId].push({
        rawMaterialId: item.rawMaterialId,
        rawMaterialName: item.rawMaterial?.name,
        unit: item.rawMaterial?.unit,
        quantity: Number(item.quantity),
      });
    }

    return Object.entries(byProduct).map(
      ([productId, ingredients]) =>
        new Recipe({
          id: `recipe-${productId}`,
          productId,
          ingredients,
        }),
    );
  }

  async save(recipe: Recipe): Promise<void> {
    // Delete previous ingredients and insert new ones
    await prisma.recipeItem.deleteMany({
      where: { productId: recipe.productId },
    });

    if (recipe.ingredients.length > 0) {
      await prisma.recipeItem.createMany({
        data: recipe.ingredients.map((ing) => ({
          productId: recipe.productId,
          rawMaterialId: ing.rawMaterialId,
          quantity: ing.quantity,
        })),
      });
    }
  }

  async deleteByProductId(productId: string): Promise<void> {
    await prisma.recipeItem.deleteMany({
      where: { productId },
    });
  }
}
