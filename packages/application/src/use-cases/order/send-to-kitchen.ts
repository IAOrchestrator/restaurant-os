import {
  Order,
  KitchenOrder,
  ok,
  err,
  type Result,
  EventType,
  ActorType,
  createDomainEvent,
} from '@restaurant-os/domain';
import type { OrderRepository } from '../../ports/order-repository';
import type { KitchenOrderRepository } from '../../ports/kitchen-order-repository';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { TableRepository } from '../../ports/table-repository';
import type { ProductRepository } from '../../ports/product-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import type { TransactionRunner } from '../../ports/transaction-runner';
import { randomUUID } from 'crypto';

export interface SendToKitchenInput {
  orderId: string;
  actorType?: ActorType;
  actorId?: string | null;
  notes?: string | null;
  priority?: number;
  isPaymentTriggered?: boolean;
}

export class SendToKitchenUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly kitchenOrderRepo?: KitchenOrderRepository,
    private readonly sessionRepo?: TableSessionRepository,
    private readonly tableRepo?: TableRepository,
    private readonly txRunner?: TransactionRunner,
    private readonly productRepo?: ProductRepository,
  ) {}

  async execute(input: SendToKitchenInput): Promise<Result<Order, Error>> {
    const executeLogic = async (repos: {
      orderRepo: OrderRepository;
      kitchenOrderRepo?: KitchenOrderRepository;
      sessionRepo?: TableSessionRepository;
      tableRepo?: TableRepository;
    }) => {
      const order = await repos.orderRepo.findById(input.orderId);
      if (!order) {
        return err(new Error('Order not found'));
      }

      let targetOrder = order;

      // Rule Phase 2.1: TAKEAWAY / DELIVERY orders only go to KDS if paid
      if (
        (targetOrder.type === 'TAKEAWAY' || targetOrder.type === 'DELIVERY') &&
        !targetOrder.isPaid &&
        !input.isPaymentTriggered
      ) {
        return err(
          new Error(
            'PEDIDO TAKEAWAY/DELIVERY no puede enviarse a cocina sin estar PAGADO previamente en Caja',
          ),
        );
      }

      if (input.isPaymentTriggered && !targetOrder.isPaid) {
        const paidResult = targetOrder.markAsPaid();
        if (paidResult.success) {
          targetOrder = paidResult.value;
        }
      }

      if (targetOrder.status === 'DRAFT') {
        const confirmed = targetOrder.confirm();
        if (!confirmed.success) {
          return err(confirmed.error);
        }
        targetOrder = confirmed.value;
      }

      let finalOrder: Order;
      let kitchenOrder: KitchenOrder | null = null;
      let isRetry = false;

      if (targetOrder.status === 'SENT_TO_KITCHEN') {
        // Idempotent retry: Order is already SENT_TO_KITCHEN
        finalOrder = targetOrder;
      } else if (targetOrder.status === 'CONFIRMED') {
        const sent = targetOrder.sendToKitchen();
        if (!sent.success) {
          return err(sent.error);
        }
        finalOrder = sent.value;
        await repos.orderRepo.save(finalOrder);
      } else {
        return err(
          new Error(
            `Cannot send to kitchen: current status is ${targetOrder.status} (expected DRAFT or CONFIRMED)`,
          ),
        );
      }

      // Lookup table context metadata for rich events and ticket naming
      let tableId: string | null = null;
      let tableNumber: number | null = null;
      if (finalOrder.tableSessionId && repos.sessionRepo) {
        const session = await repos.sessionRepo.findById(finalOrder.tableSessionId);
        if (session?.tableId && repos.tableRepo) {
          tableId = session.tableId;
          const table = await repos.tableRepo.findById(tableId);
          tableNumber = table?.number ?? null;
        }
      }

      const orderShortCode = finalOrder.id.length >= 2 ? finalOrder.id.replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || '45' : '45';
      const tableLabel = tableNumber
        ? `M${tableNumber}`
        : (finalOrder.type === 'TAKEAWAY' ? `L-${orderShortCode}` : (finalOrder.type === 'DELIVERY' ? `D-${orderShortCode}` : `O-${orderShortCode}`));

      // Partition items by Sector (PIZZAS, BEBIDAS, HELADOS, CAFE)
      const sectorMap: Record<string, Array<{ productId: string; name?: string; quantity: number; notes?: string }>> = {};

      for (const item of finalOrder.items) {
        let sector = 'PIZZAS';
        let itemName = item.productId;

        if (this.productRepo) {
          try {
            const prod = await this.productRepo.findById(item.productId);
            if (prod) {
              sector = prod.sectorKDS || 'PIZZAS';
              itemName = prod.name;
            }
          } catch {
            // fallback
          }
        } else {
          const lower = item.productId.toLowerCase();
          if (
            lower.includes('coca') ||
            lower.includes('bebida') ||
            lower.includes('agua') ||
            lower.includes('vino') ||
            lower.includes('cerveza') ||
            lower.includes('drink') ||
            lower.includes('sprite') ||
            lower.includes('fanta')
          ) {
            sector = 'BEBIDAS';
          } else if (lower.includes('helado') || lower.includes('postre') || lower.includes('icecream') || lower.includes('flan')) {
            sector = 'HELADOS';
          } else if (lower.includes('cafe') || lower.includes('café') || lower.includes('cortado') || lower.includes('te')) {
            sector = 'CAFE';
          }
        }

        if (!sectorMap[sector]) {
          sectorMap[sector] = [];
        }
        sectorMap[sector].push({
          productId: item.productId,
          name: itemName,
          quantity: item.quantity,
          notes: item.notes,
        });
      }

      const primarySector = Object.keys(sectorMap)[0] || 'PIZZAS';
      const primaryTicketCode = `T-${tableLabel}-01-${primarySector}`;

      const tickets = Object.entries(sectorMap).map(([sec, secItems]) => ({
        id: randomUUID(),
        sector: sec,
        ticketCode: `T-${tableLabel}-01-${sec}`,
        items: secItems,
        status: 'RECEIVED',
      }));

      const notesPayload = JSON.stringify({
        sector: primarySector,
        ticketCode: primaryTicketCode,
        tickets,
        items: finalOrder.items,
        userNotes: input.notes ?? null,
      });

      if (repos.kitchenOrderRepo) {
        const existingKO = await repos.kitchenOrderRepo.findByOrderId(finalOrder.id);
        if (existingKO) {
          kitchenOrder = existingKO;
          isRetry = true;
        } else {
          const created = KitchenOrder.create({
            id: randomUUID(),
            restaurantId: finalOrder.restaurantId,
            orderId: finalOrder.id,
            sector: primarySector,
            ticketCode: primaryTicketCode,
            items: finalOrder.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              notes: it.notes,
            })),
            notes: notesPayload,
            priority: input.priority ?? 0,
          });
          if (!created.success) return err(created.error);
          kitchenOrder = created.value;
          await repos.kitchenOrderRepo.save(kitchenOrder);
        }
      }

      return ok({
        order: finalOrder,
        kitchenOrder,
        isRetry,
        tableId,
        tableNumber,
      });
    };

    let result: {
      order: Order;
      kitchenOrder: KitchenOrder | null;
      isRetry: boolean;
      tableId: string | null;
      tableNumber: number | null;
    };

    if (this.txRunner) {
      const txRes = await this.txRunner.run(async (ctx) => {
        return executeLogic({
          orderRepo: ctx.orderRepo,
          kitchenOrderRepo: ctx.kitchenOrderRepo,
          sessionRepo: ctx.sessionRepo,
          tableRepo: ctx.tableRepo,
        });
      });
      if (!txRes.success) return err(txRes.error);
      result = txRes.value;
    } else {
      const res = await executeLogic({
        orderRepo: this.orderRepo,
        kitchenOrderRepo: this.kitchenOrderRepo,
        sessionRepo: this.sessionRepo,
        tableRepo: this.tableRepo,
      });
      if (!res.success) return err(res.error);
      result = res.value;
    }

    // Strictly POST-COMMIT event publishing (skipped on duplicate retry)
    if (!result.isRetry) {
      await this.eventPublisher.publish(
        createDomainEvent({
          type: EventType.ORDER_SENT_TO_KITCHEN,
          restaurantId: result.order.restaurantId,
          aggregateType: 'Order',
          aggregateId: result.order.id,
          tableSessionId: result.order.tableSessionId ?? null,
          tableId: result.tableId,
          tableNumber: result.tableNumber,
          actorType: input.actorType ?? ActorType.STAFF,
          actorId: input.actorId ?? null,
          payload: {
            orderId: result.order.id,
            kitchenOrderId: result.kitchenOrder?.id ?? null,
            restaurantId: result.order.restaurantId,
            tableSessionId: result.order.tableSessionId ?? null,
            tableId: result.tableId,
            tableNumber: result.tableNumber,
          },
        }),
      );
    }

    return ok(result.order);
  }
}
