import {
  Order,
  KitchenOrderStatus,
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

export interface DeliverOrderInput {
  orderId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class DeliverOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly kitchenOrderRepo?: KitchenOrderRepository,
    private readonly sessionRepo?: TableSessionRepository,
    private readonly tableRepo?: TableRepository,
    private readonly txRunner?: TransactionRunner,
  ) {}

  async execute(input: DeliverOrderInput): Promise<Result<Order, Error>> {
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
      if (targetOrder.status === 'SENT_TO_KITCHEN') {
        const prep = targetOrder.startPreparing();
        if (prep.success) targetOrder = prep.value;
      }
      if (targetOrder.status === 'PREPARING') {
        const ready = targetOrder.markReady();
        if (ready.success) targetOrder = ready.value;
      }

      const delivered = targetOrder.deliver();
      if (!delivered.success) {
        return err(delivered.error);
      }

      // Synchronize KitchenOrder to COMPLETED in same transaction
      if (repos.kitchenOrderRepo) {
        const kitchenOrder = await repos.kitchenOrderRepo.findByOrderId(order.id);
        if (kitchenOrder) {
          let koToComplete = kitchenOrder;
          if (koToComplete.status === KitchenOrderStatus.RECEIVED) {
            const startKO = koToComplete.start();
            if (startKO.success) koToComplete = startKO.value;
          }
          if (
            koToComplete.status === KitchenOrderStatus.STARTED ||
            koToComplete.status === KitchenOrderStatus.NEARLY_READY
          ) {
            const readyKO = koToComplete.markReady();
            if (readyKO.success) koToComplete = readyKO.value;
          }
          if (koToComplete.status === KitchenOrderStatus.READY) {
            const compKO = koToComplete.complete();
            if (compKO.success) {
              await repos.kitchenOrderRepo.save(compKO.value);
            }
          }
        }
      }

      await repos.orderRepo.save(delivered.value);

      // Lookup table context metadata for rich events
      let tableId: string | null = null;
      let tableNumber: number | null = null;
      if (delivered.value.tableSessionId && repos.sessionRepo) {
        const session = await repos.sessionRepo.findById(delivered.value.tableSessionId);
        if (session?.tableId && repos.tableRepo) {
          tableId = session.tableId;
          const table = await repos.tableRepo.findById(tableId);
          tableNumber = table?.number ?? null;
        }
      }

      return ok({
        order: delivered.value,
        tableId,
        tableNumber,
      });
    };

    let result: {
      order: Order;
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

    // Strictly POST-COMMIT event publishing
    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.ORDER_DELIVERED,
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
          restaurantId: result.order.restaurantId,
          tableSessionId: result.order.tableSessionId ?? null,
          tableId: result.tableId,
          tableNumber: result.tableNumber,
        },
      }),
    );

    return ok(result.order);
  }
}
