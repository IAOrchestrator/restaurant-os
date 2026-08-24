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
        if (repos.kitchenOrderRepo) {
          kitchenOrder = await repos.kitchenOrderRepo.findByOrderId(targetOrder.id);
          if (!kitchenOrder) {
            const created = KitchenOrder.create({
              id: randomUUID(),
              restaurantId: targetOrder.restaurantId,
              orderId: targetOrder.id,
              notes: input.notes ?? null,
              priority: input.priority ?? 0,
            });
            if (!created.success) return err(created.error);
            kitchenOrder = created.value;
            await repos.kitchenOrderRepo.save(kitchenOrder);
          } else {
            isRetry = true;
          }
        }
      } else if (targetOrder.status === 'CONFIRMED') {
        const sent = targetOrder.sendToKitchen();
        if (!sent.success) {
          return err(sent.error);
        }
        finalOrder = sent.value;

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
              notes: input.notes ?? null,
              priority: input.priority ?? 0,
            });
            if (!created.success) return err(created.error);
            kitchenOrder = created.value;
            await repos.kitchenOrderRepo.save(kitchenOrder);
          }
        }

        await repos.orderRepo.save(finalOrder);
      } else {
        return err(
          new Error(
            `Cannot send to kitchen: current status is ${targetOrder.status} (expected DRAFT or CONFIRMED)`,
          ),
        );
      }

      // Lookup table context metadata for rich events
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
