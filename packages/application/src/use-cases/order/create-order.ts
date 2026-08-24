import {
  Order,
  OrderType,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { OrderRepository } from '../../ports/order-repository';
import type { PreOrderRepository } from '../../ports/preorder-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface CreateOrderInput {
  id: string;
  restaurantId: string;
  tableSessionId: string;
  customerId?: string | null;
  preOrderId?: string | null;
  type?: OrderType;
  items: Array<{ productId: string; quantity: number; unitPrice: number; notes?: string }>;
  actorType?: ActorType;
  actorId?: string | null;
}

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly preOrderRepo: PreOrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateOrderInput): Promise<Result<Order, Error>> {
    // If preOrderId provided, validate and atomically confirm/consume it so its intent QR dies
    if (input.preOrderId) {
      const preOrder = await this.preOrderRepo.findById(input.preOrderId);
      if (!preOrder) {
        return err(new Error('PreOrder not found'));
      }
      if (preOrder.status !== 'CONFIRMED') {
        const confirmedPre = preOrder.confirm();
        if (confirmedPre.success) {
          await this.preOrderRepo.save(confirmedPre.value);
        }
      }
    }

    const orderResult = Order.create({
      id: input.id,
      restaurantId: input.restaurantId,
      tableSessionId: input.tableSessionId,
      customerId: input.customerId ?? null,
      type: input.type ?? 'DINE_IN',
    });

    if (!orderResult.success) {
      return err(orderResult.error);
    }

    // Add all items
    let order = orderResult.value;
    for (const item of input.items) {
      const added = order.addItem(item);
      if (!added.success) return err(added.error);
      order = added.value;
    }

    const confirmed = order.confirm();
    if (!confirmed.success) {
      return err(confirmed.error);
    }
    order = confirmed.value;

    await this.orderRepo.save(order);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.ORDER_CONFIRMED,
        restaurantId: order.restaurantId,
        aggregateType: 'Order',
        aggregateId: order.id,
        tableSessionId: order.tableSessionId,
        actorType: input.actorType ?? (input.customerId ? ActorType.CUSTOMER : ActorType.STAFF),
        actorId: input.actorId ?? input.customerId ?? null,
        payload: {
          orderId: order.id,
          restaurantId: order.restaurantId,
          tableSessionId: order.tableSessionId,
          preOrderId: input.preOrderId ?? null,
          totalAmount: order.totalAmount,
        },
      }),
    );

    return ok(order);
  }
}
