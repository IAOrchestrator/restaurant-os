import { RawMaterial, UnitOfMeasure } from '@restaurant-os/domain';
import { RawMaterialRepository } from '../../ports/raw-material-repository';

export interface CreateRawMaterialInput {
  id?: string;
  restaurantId: string;
  name: string;
  unit: UnitOfMeasure;
  currentStock: number;
  minStockAlert: number;
  unitCost: number;
}

export class CreateRawMaterialUseCase {
  constructor(private rawMaterialRepo: RawMaterialRepository) {}

  async execute(input: CreateRawMaterialInput): Promise<RawMaterial> {
    const rawMaterial = new RawMaterial({
      id: input.id || crypto.randomUUID(),
      restaurantId: input.restaurantId,
      name: input.name,
      unit: input.unit,
      currentStock: input.currentStock,
      minStockAlert: input.minStockAlert,
      unitCost: input.unitCost,
    });

    await this.rawMaterialRepo.save(rawMaterial);
    return rawMaterial;
  }
}
