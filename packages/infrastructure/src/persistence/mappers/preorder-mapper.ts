import { PreOrder, PreOrderStatus } from '@restaurant-os/domain';
import type { PreOrder as PrismaPreOrder } from '@restaurant-os/database';

export class PreOrderMapper {
  static toDomain(prismaPreOrder: PrismaPreOrder): PreOrder | null {
    let items: Array<{ productId: string; quantity: number; notes?: string }> = [];
    try {
      if (prismaPreOrder.items && typeof prismaPreOrder.items === 'object') {
        const parsed = prismaPreOrder.items as Record<string, unknown>;
        if (Array.isArray(parsed)) {
          items = parsed.map((item: unknown) => {
            const i = item as Record<string, unknown>;
            return {
              productId: String(i.productId ?? ''),
              quantity: Number(i.quantity ?? 0),
              notes: i.notes ? String(i.notes) : undefined,
            };
          });
        }
      }
    } catch {
      items = [];
    }

    const result = PreOrder.create({
      id: prismaPreOrder.id,
      restaurantId: prismaPreOrder.restaurantId,
      customerId: prismaPreOrder.customerId,
      items,
      createdAt: prismaPreOrder.createdAt,
    });

    if (!result.success) return null;
    let preOrder = result.value;

    // Replay state transitions
    const targetStatus = prismaPreOrder.status as PreOrderStatus;
    const transitions: Record<PreOrderStatus, () => void> = {
      [PreOrderStatus.DRAFT]: () => {},
      [PreOrderStatus.READY]: () => {
        const r = preOrder.markReady();
        if (r.success) preOrder = r.value;
      },
      [PreOrderStatus.REVIEWING]: () => {
        let r = preOrder.markReady();
        if (r.success) preOrder = r.value;
        r = preOrder.startReview();
        if (r.success) preOrder = r.value;
      },
      [PreOrderStatus.CONFIRMED]: () => {
        let r = preOrder.markReady();
        if (r.success) preOrder = r.value;
        r = preOrder.startReview();
        if (r.success) preOrder = r.value;
        r = preOrder.confirm();
        if (r.success) preOrder = r.value;
      },
      [PreOrderStatus.CANCELLED]: () => {
        const r = preOrder.cancel();
        if (r.success) preOrder = r.value;
      },
    };

    transitions[targetStatus]();
    return preOrder;
  }

  static toPrisma(preOrder: PreOrder): Omit<PrismaPreOrder, 'restaurant' | 'customer'> {
    return {
      id: preOrder.id,
      restaurantId: preOrder.restaurantId,
      customerId: preOrder.customerId,
      status: preOrder.status,
      items: preOrder.items as any,
      createdAt: preOrder.createdAt,
      updatedAt: preOrder.updatedAt,
    };
  }
}
