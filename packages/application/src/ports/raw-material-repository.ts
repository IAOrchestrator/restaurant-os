import { RawMaterial } from '@restaurant-os/domain';

export interface RawMaterialRepository {
  findById(id: string): Promise<RawMaterial | null>;
  findByRestaurantId(restaurantId: string): Promise<RawMaterial[]>;
  findLowStockByRestaurantId(restaurantId: string): Promise<RawMaterial[]>;
  save(rawMaterial: RawMaterial): Promise<void>;
  saveMany(rawMaterials: RawMaterial[]): Promise<void>;
  delete(id: string): Promise<void>;
}
