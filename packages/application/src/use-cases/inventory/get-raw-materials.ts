import { RawMaterial } from '@restaurant-os/domain';
import { RawMaterialRepository } from '../../ports/raw-material-repository';

export class GetRawMaterialsUseCase {
  constructor(private rawMaterialRepo: RawMaterialRepository) {}

  async execute(restaurantId: string): Promise<RawMaterial[]> {
    return this.rawMaterialRepo.findByRestaurantId(restaurantId);
  }
}
