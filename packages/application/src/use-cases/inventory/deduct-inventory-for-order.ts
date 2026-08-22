import { RawMaterialRepository } from '../../ports/raw-material-repository';
import { RecipeRepository } from '../../ports/recipe-repository';
import { EventPublisher } from '../../ports/event-publisher';

export interface DeductInventoryInput {
  restaurantId: string;
  orderId: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface DeductionSummary {
  rawMaterialId: string;
  rawMaterialName: string;
  deductedAmount: number;
  remainingStock: number;
  isLowStock: boolean;
}

export class DeductInventoryForOrderUseCase {
  constructor(
    private rawMaterialRepo: RawMaterialRepository,
    private recipeRepo: RecipeRepository,
    private eventPublisher?: EventPublisher,
  ) {}

  async execute(input: DeductInventoryInput): Promise<DeductionSummary[]> {
    if (!input.items || input.items.length === 0) return [];

    const productIds = input.items.map((i) => i.productId);
    const recipes = await this.recipeRepo.findByProductIds(productIds);
    const recipeMap = new Map(recipes.map((r) => [r.productId, r]));

    // Aggregate required amounts per raw material
    const requiredByMaterial = new Map<string, number>();

    for (const item of input.items) {
      const recipe = recipeMap.get(item.productId);
      if (!recipe) continue;

      const requiredList = recipe.calculateTotalRequired(item.quantity);
      for (const req of requiredList) {
        const current = requiredByMaterial.get(req.rawMaterialId) || 0;
        requiredByMaterial.set(req.rawMaterialId, current + req.totalQuantity);
      }
    }

    if (requiredByMaterial.size === 0) return [];

    const summaries: DeductionSummary[] = [];

    // Deduct from raw materials
    for (const [rawMaterialId, amountToDeduct] of requiredByMaterial.entries()) {
      const rawMaterial = await this.rawMaterialRepo.findById(rawMaterialId);
      if (!rawMaterial) continue;

      const { isBelowMinAlert, newStock } = rawMaterial.deduct(amountToDeduct);
      await this.rawMaterialRepo.save(rawMaterial);

      summaries.push({
        rawMaterialId: rawMaterial.id,
        rawMaterialName: rawMaterial.name,
        deductedAmount: amountToDeduct,
        remainingStock: newStock,
        isLowStock: isBelowMinAlert,
      });

      if (isBelowMinAlert && this.eventPublisher) {
        await this.eventPublisher.publish('STOCK_ALERT_TRIGGERED', {
          restaurantId: input.restaurantId,
          rawMaterialId: rawMaterial.id,
          rawMaterialName: rawMaterial.name,
          currentStock: newStock,
          minStockAlert: rawMaterial.minStockAlert,
        });
      }
    }

    return summaries;
  }
}
