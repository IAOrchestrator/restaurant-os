import type { TableDevice } from '@restaurant-os/domain';

export interface TableDeviceRepository {
  findById(id: string): Promise<TableDevice | null>;
  findByTableId(tableId: string): Promise<TableDevice | null>;
  findByRestaurantId(restaurantId: string): Promise<TableDevice[]>;
  save(device: TableDevice): Promise<void>;
  delete(id: string): Promise<void>;
}
