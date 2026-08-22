import type { TableSession, TableSessionId } from '@restaurant-os/domain';

export interface TableSessionRepository {
  findById(id: TableSessionId): Promise<TableSession | null>;
  findActiveByTableId(tableId: string): Promise<TableSession | null>;
  findByRestaurantId(restaurantId: string): Promise<TableSession[]>;
  save(session: TableSession): Promise<void>;
}
