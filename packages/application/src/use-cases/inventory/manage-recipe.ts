import { Recipe, RecipeIngredient } from '@restaurant-os/domain';
import { RecipeRepository } from '../../ports/recipe-repository';

export interface SetRecipeInput {
  productId: string;
  ingredients: RecipeIngredient[];
}

export class ManageRecipeUseCase {
  constructor(private recipeRepo: RecipeRepository) {}

  async getRecipe(productId: string): Promise<Recipe | null> {
    return this.recipeRepo.findByProductId(productId);
  }

  async setRecipe(input: SetRecipeInput): Promise<Recipe> {
    const recipe = new Recipe({
      id: `recipe-${input.productId}`,
      productId: input.productId,
      ingredients: input.ingredients,
    });

    await this.recipeRepo.save(recipe);
    return recipe;
  }
}
