import type { KitchenOrder, KitchenOrderId } from '@restaurant-os/domain';

export interface KitchenOrderRepository {
  findById(id: KitchenOrderId): Promise<KitchenOrder | null>;
  findByOrderId(orderId: string): Promise<KitchenOrder | null>;
  findByRestaurantId(restaurantId: string, status?: string): Promise<KitchenOrder[]>;
  findByAssignedTo(staffId: string): Promise<KitchenOrder[]>;
  save(kitchenOrder: KitchenOrder): Promise<void>;
  delete(id: KitchenOrderId): Promise<void>;
}
