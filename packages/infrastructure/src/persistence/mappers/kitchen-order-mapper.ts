import { KitchenOrder, KitchenOrderStatus } from '@restaurant-os/domain';
import type { KitchenOrder as PrismaKitchenOrder } from '@restaurant-os/database';

export class KitchenOrderMapper {
  static toDomain(prismaOrder: PrismaKitchenOrder): KitchenOrder | null {
    const result = KitchenOrder.create({
      id: prismaOrder.id,
      restaurantId: prismaOrder.restaurantId,
      orderId: prismaOrder.orderId,
      assignedTo: prismaOrder.assignedTo,
      priority: prismaOrder.priority,
      notes: prismaOrder.notes,
      createdAt: prismaOrder.createdAt,
    });

    if (!result.success) return null;
    let order = result.value;

    // Replay state transitions
    const targetStatus = prismaOrder.status as KitchenOrderStatus;
    const transitions: Record<KitchenOrderStatus, () => void> = {
      [KitchenOrderStatus.RECEIVED]: () => {},
      [KitchenOrderStatus.STARTED]: () => {
        const r = order.start();
        if (r.success) order = r.value;
      },
      [KitchenOrderStatus.NEARLY_READY]: () => {
        let r = order.start();
        if (r.success) order = r.value;
        r = order.markNearlyReady();
        if (r.success) order = r.value;
      },
      [KitchenOrderStatus.READY]: () => {
        let r = order.start();
        if (r.success) order = r.value;
        r = order.markReady();
        if (r.success) order = r.value;
      },
      [KitchenOrderStatus.COMPLETED]: () => {
        let r = order.start();
        if (r.success) order = r.value;
        r = order.markReady();
        if (r.success) order = r.value;
        r = order.complete();
        if (r.success) order = r.value;
      },
    };

    transitions[targetStatus]();
    return order;
  }

  static toPrisma(order: KitchenOrder): Omit<PrismaKitchenOrder, 'restaurant'> {
    return {
      id: order.id,
      restaurantId: order.restaurantId,
      orderId: order.orderId,
      status: order.status,
      assignedTo: order.assignedTo,
      priority: order.priority,
      receivedAt: order.receivedAt,
      startedAt: order.startedAt,
      nearlyReadyAt: order.nearlyReadyAt,
      readyAt: order.readyAt,
      completedAt: order.completedAt,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
