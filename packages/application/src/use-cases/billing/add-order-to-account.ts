import {
  Account,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { AccountRepository } from '../../ports/account-repository';
import type { OrderRepository } from '../../ports/order-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface AddOrderToAccountInput {
  accountId: string;
  orderId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class AddOrderToAccountUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly orderRepo: OrderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: AddOrderToAccountInput): Promise<Result<Account, Error>> {
    const account = await this.accountRepo.findById(input.accountId);
    if (!account) {
      return err(new Error('Account not found'));
    }

    const order = await this.orderRepo.findById(input.orderId);
    if (!order) {
      return err(new Error('Order not found'));
    }

    const updated = account.addOrderAmount(order.totalAmount);
    if (!updated.success) {
      return err(updated.error);
    }

    await this.accountRepo.save(updated.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.ADDITIONAL_ORDER_CREATED,
        restaurantId: updated.value.restaurantId,
        aggregateType: 'Account',
        aggregateId: updated.value.id,
        tableSessionId: updated.value.tableSessionId,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          accountId: updated.value.id,
          orderId: input.orderId,
          amount: order.totalAmount,
          newTotal: updated.value.totalAmount,
        },
      }),
    );

    return ok(updated.value);
  }
}
