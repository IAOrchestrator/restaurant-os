import { Account } from '@restaurant-os/domain';
import type { AccountRepository } from '../../ports/account-repository';
import type { OrderRepository } from '../../ports/order-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface AddOrderToAccountInput {
  accountId: string;
  orderId: string;
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
    await this.eventPublisher.publish('ADDITIONAL_ORDER_CREATED', {
      accountId: updated.value.id,
      orderId: input.orderId,
      amount: order.totalAmount,
      newTotal: updated.value.totalAmount,
    });

    return ok(updated.value);
  }
}
