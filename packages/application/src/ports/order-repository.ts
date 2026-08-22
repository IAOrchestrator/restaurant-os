import type { Order, OrderId } from '@restaurant-os/domain';

export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findByTableSessionId(tableSessionId: string): Promise<Order[]>;
  findByRestaurantId(restaurantId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  delete(id: OrderId): Promise<void>;
}
