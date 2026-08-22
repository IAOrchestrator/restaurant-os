import { Order, OrderStatus } from '@restaurant-os/domain';
import type { Order as PrismaOrder } from '@restaurant-os/database';

export class OrderMapper {
  static toDomain(prismaOrder: PrismaOrder): Order | null {
    let items: Array<{ productId: string; quantity: number; unitPrice: number; notes?: string }> = [];
    try {
      if (prismaOrder.items && typeof prismaOrder.items === 'object') {
        const parsed = prismaOrder.items as Record<string, unknown>;
        if (Array.isArray(parsed)) {
          items = parsed.map((item: unknown) => {
            const i = item as Record<string, unknown>;
            return {
              productId: String(i.productId ?? ''),
              quantity: Number(i.quantity ?? 0),
              unitPrice: Number(i.unitPrice ?? 0),
              notes: i.notes ? String(i.notes) : undefined,
            };
          });
        }
      }
    } catch {
      items = [];
    }

    const result = Order.create({
      id: prismaOrder.id,
      restaurantId: prismaOrder.restaurantId,
      tableSessionId: prismaOrder.tableSessionId,
      customerId: prismaOrder.customerId,
      items,
      createdAt: prismaOrder.createdAt,
    });

    if (!result.success) return null;
    let order = result.value;

    // Replay state transitions
    const targetStatus = prismaOrder.status as OrderStatus;
    const transitions: Record<OrderStatus, () => void> = {
      [OrderStatus.DRAFT]: () => {},
      [OrderStatus.CONFIRMED]: () => {
        const r = order.confirm();
        if (r.success) order = r.value;
      },
      [OrderStatus.SENT_TO_KITCHEN]: () => {
        let r = order.confirm();
        if (r.success) order = r.value;
        r = order.sendToKitchen();
        if (r.success) order = r.value;
      },
      [OrderStatus.PREPARING]: () => {
        let r = order.confirm();
        if (r.success) order = r.value;
        r = order.sendToKitchen();
        if (r.success) order = r.value;
        r = order.startPreparing();
        if (r.success) order = r.value;
      },
      [OrderStatus.READY]: () => {
        let r = order.confirm();
        if (r.success) order = r.value;
        r = order.sendToKitchen();
        if (r.success) order = r.value;
        r = order.startPreparing();
        if (r.success) order = r.value;
        r = order.markReady();
        if (r.success) order = r.value;
      },
      [OrderStatus.DELIVERED]: () => {
        let r = order.confirm();
        if (r.success) order = r.value;
        r = order.sendToKitchen();
        if (r.success) order = r.value;
        r = order.startPreparing();
        if (r.success) order = r.value;
        r = order.markReady();
        if (r.success) order = r.value;
        r = order.deliver();
        if (r.success) order = r.value;
      },
      [OrderStatus.CANCELLED]: () => {
        const r = order.cancel();
        if (r.success) order = r.value;
      },
    };

    transitions[targetStatus]();
    return order;
  }

  static toPrisma(order: Order): Omit<PrismaOrder, 'restaurant' | 'tableSession' | 'customer'> {
    return {
      id: order.id,
      restaurantId: order.restaurantId,
      tableSessionId: order.tableSessionId,
      customerId: order.customerId,
      status: order.status,
      items: order.items as any,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
