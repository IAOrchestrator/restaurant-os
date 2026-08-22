import { RawMaterial } from '@restaurant-os/domain';
import { RawMaterialRepository } from '../../ports/raw-material-repository';

export interface UpdateRawMaterialStockInput {
  id: string;
  adjustment: number; // positive = restock, negative = deduction/loss
}

export class UpdateRawMaterialStockUseCase {
  constructor(private rawMaterialRepo: RawMaterialRepository) {}

  async execute(input: UpdateRawMaterialStockInput): Promise<RawMaterial> {
    const rawMaterial = await this.rawMaterialRepo.findById(input.id);
    if (!rawMaterial) {
      throw new Error(`RawMaterial with ID ${input.id} not found`);
    }

    if (input.adjustment >= 0) {
      rawMaterial.restock(input.adjustment);
    } else {
      rawMaterial.deduct(Math.abs(input.adjustment));
    }

    await this.rawMaterialRepo.save(rawMaterial);
    return rawMaterial;
  }
}
