import {
  KitchenOrder,
  Order,
  ok,
  err,
  type Result,
  EventType,
  ActorType,
  createDomainEvent,
} from '@restaurant-os/domain';
import type { KitchenOrderRepository } from '../../ports/kitchen-order-repository';
import type { OrderRepository } from '../../ports/order-repository';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import type { TransactionRunner } from '../../ports/transaction-runner';

export interface StartKitchenOrderInput {
  kitchenOrderId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class StartKitchenOrderUseCase {
  constructor(
    private readonly kitchenOrderRepo: KitchenOrderRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly orderRepo?: OrderRepository,
    private readonly sessionRepo?: TableSessionRepository,
    private readonly tableRepo?: TableRepository,
    private readonly txRunner?: TransactionRunner,
  ) {}

  async execute(input: StartKitchenOrderInput): Promise<Result<KitchenOrder, Error>> {
    const executeLogic = async (repos: {
      kitchenOrderRepo: KitchenOrderRepository;
      orderRepo?: OrderRepository;
      sessionRepo?: TableSessionRepository;
      tableRepo?: TableRepository;
    }) => {
      const kitchenOrder = await repos.kitchenOrderRepo.findById(input.kitchenOrderId);
      if (!kitchenOrder) {
        return err(new Error('Kitchen order not found'));
      }

      const started = kitchenOrder.start();
      if (!started.success) {
        return err(started.error);
      }

      let order: Order | null = null;
      if (repos.orderRepo) {
        order = await repos.orderRepo.findById(kitchenOrder.orderId);
        if (!order) {
          return err(new Error(`Associated order not found: ${kitchenOrder.orderId}`));
        }
        if (order.status === 'SENT_TO_KITCHEN') {
          const prepRes = order.startPreparing();
          if (!prepRes.success) {
            return err(prepRes.error);
          }
          order = prepRes.value;
          await repos.orderRepo.save(order);
        }
      }

      await repos.kitchenOrderRepo.save(started.value);

      // Lookup table context metadata for rich events
      let tableId: string | null = null;
      let tableNumber: number | null = null;
      if (order?.tableSessionId && repos.sessionRepo) {
        const session = await repos.sessionRepo.findById(order.tableSessionId);
        if (session?.tableId && repos.tableRepo) {
          tableId = session.tableId;
          const table = await repos.tableRepo.findById(tableId);
          tableNumber = table?.number ?? null;
        }
      }

      return ok({
        kitchenOrder: started.value,
        order,
        tableId,
        tableNumber,
      });
    };

    let result: {
      kitchenOrder: KitchenOrder;
      order: Order | null;
      tableId: string | null;
      tableNumber: number | null;
    };

    if (this.txRunner) {
      const txRes = await this.txRunner.run(async (ctx) => {
        return executeLogic({
          kitchenOrderRepo: ctx.kitchenOrderRepo,
          orderRepo: ctx.orderRepo,
          sessionRepo: ctx.sessionRepo,
          tableRepo: ctx.tableRepo,
        });
      });
      if (!txRes.success) return err(txRes.error);
      result = txRes.value;
    } else {
      const res = await executeLogic({
        kitchenOrderRepo: this.kitchenOrderRepo,
        orderRepo: this.orderRepo,
        sessionRepo: this.sessionRepo,
        tableRepo: this.tableRepo,
      });
      if (!res.success) return err(res.error);
      result = res.value;
    }

    // Strictly POST-COMMIT event publishing
    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.KITCHEN_STARTED,
        restaurantId: result.kitchenOrder.restaurantId,
        aggregateType: 'KitchenOrder',
        aggregateId: result.kitchenOrder.id,
        tableSessionId: result.order?.tableSessionId ?? null,
        tableId: result.tableId,
        tableNumber: result.tableNumber,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          kitchenOrderId: result.kitchenOrder.id,
          orderId: result.kitchenOrder.orderId,
          restaurantId: result.kitchenOrder.restaurantId,
          tableSessionId: result.order?.tableSessionId ?? null,
          tableId: result.tableId,
          tableNumber: result.tableNumber,
        },
      }),
    );

    return ok(result.kitchenOrder);
  }
}
