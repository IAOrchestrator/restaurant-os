import type { PreOrder, PreOrderId } from '@restaurant-os/domain';

export interface PreOrderRepository {
  findById(id: PreOrderId): Promise<PreOrder | null>;
  findByCustomerId(customerId: string): Promise<PreOrder[]>;
  findByRestaurantId(restaurantId: string): Promise<PreOrder[]>;
  save(preOrder: PreOrder): Promise<void>;
  delete(id: PreOrderId): Promise<void>;
}
