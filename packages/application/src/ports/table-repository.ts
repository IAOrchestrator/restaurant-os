import type { Table, TableId } from '@restaurant-os/domain';

export interface TableRepository {
  findById(id: TableId): Promise<Table | null>;
  findByRestaurantId(restaurantId: string): Promise<Table[]>;
  save(table: Table): Promise<void>;
  delete(id: TableId): Promise<void>;
}
