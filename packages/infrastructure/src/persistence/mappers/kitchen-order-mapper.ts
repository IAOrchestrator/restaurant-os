import { KitchenOrder, KitchenOrderStatus } from '@restaurant-os/domain';
import type { KitchenOrder as PrismaKitchenOrder } from '@restaurant-os/database';

export class KitchenOrderMapper {
  static toDomain(prismaOrder: PrismaKitchenOrder): KitchenOrder | null {
    let sector = 'PIZZAS';
    let ticketCode: string | null = null;
    let items: Array<{ productId: string; name?: string; quantity: number; notes?: string }> = [];
    let userNotes = prismaOrder.notes;

    if (prismaOrder.notes) {
      try {
        const parsed = JSON.parse(prismaOrder.notes);
        if (parsed && typeof parsed === 'object') {
          if (parsed.sector) sector = parsed.sector;
          if (parsed.ticketCode) ticketCode = parsed.ticketCode;
          if (Array.isArray(parsed.items)) items = parsed.items;
          if (parsed.userNotes !== undefined) userNotes = parsed.userNotes;
        }
      } catch {
        // regular string notes
      }
    }

    const result = KitchenOrder.create({
      id: prismaOrder.id,
      restaurantId: prismaOrder.restaurantId,
      orderId: prismaOrder.orderId,
      assignedTo: prismaOrder.assignedTo,
      priority: prismaOrder.priority,
      sector,
      ticketCode,
      items,
      notes: userNotes,
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
    let notesPayload = order.notes;
    try {
      notesPayload = JSON.stringify({
        sector: order.sector,
        ticketCode: order.ticketCode,
        items: order.items,
        userNotes: order.notes,
      });
    } catch {
      notesPayload = order.notes;
    }

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
      notes: notesPayload,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
