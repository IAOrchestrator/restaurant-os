import { Order, OrderStatus } from '@restaurant-os/domain';
import type { Order as PrismaOrder } from '@restaurant-os/database';

export class OrderMapper {
  static toDomain(prismaOrder: PrismaOrder): Order | null {
    let items: Array<{ productId: string; quantity: number; unitPrice: number; notes?: string }> = [];
    let orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' = 'DINE_IN';
    let isPaid = false;

    try {
      if (prismaOrder.items && typeof prismaOrder.items === 'object') {
        const raw = prismaOrder.items as any;
        if (Array.isArray(raw)) {
          items = raw.map((item: any) => ({
            productId: String(item.productId ?? ''),
            quantity: Number(item.quantity ?? 0),
            unitPrice: Number(item.unitPrice ?? 0),
            notes: item.notes ? String(item.notes) : undefined,
          }));
        } else if (raw && Array.isArray(raw.items)) {
          items = raw.items.map((item: any) => ({
            productId: String(item.productId ?? ''),
            quantity: Number(item.quantity ?? 0),
            unitPrice: Number(item.unitPrice ?? 0),
            notes: item.notes ? String(item.notes) : undefined,
          }));
          if (raw._meta?.type) orderType = raw._meta.type;
          if (raw._meta?.isPaid) isPaid = raw._meta.isPaid;
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
      type: orderType,
      isPaid,
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
    const payload = {
      items: order.items,
      _meta: {
        type: order.type,
        isPaid: order.isPaid,
      },
    };
    return {
      id: order.id,
      restaurantId: order.restaurantId,
      tableSessionId: order.tableSessionId,
      customerId: order.customerId,
      status: order.status,
      items: payload as any,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
