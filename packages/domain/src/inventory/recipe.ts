export interface RecipeIngredient {
  rawMaterialId: string;
  rawMaterialName?: string;
  unit?: string;
  quantity: number;
}

export interface RecipeProps {
  id: string;
  productId: string;
  ingredients: RecipeIngredient[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class Recipe {
  public readonly id: string;
  public readonly productId: string;
  public ingredients: RecipeIngredient[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: RecipeProps) {
    if (!props.id) throw new Error('Recipe ID is required');
    if (!props.productId) throw new Error('Product ID is required');

    this.id = props.id;
    this.productId = props.productId;
    this.ingredients = props.ingredients || [];
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public calculateTotalRequired(productQuantity: number): Array<{ rawMaterialId: string; totalQuantity: number }> {
    if (productQuantity <= 0) return [];
    return this.ingredients.map((ing) => ({
      rawMaterialId: ing.rawMaterialId,
      totalQuantity: ing.quantity * productQuantity,
    }));
  }
}
