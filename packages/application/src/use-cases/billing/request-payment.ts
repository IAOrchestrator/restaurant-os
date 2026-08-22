import { Account } from '@restaurant-os/domain';
import type { AccountRepository } from '../../ports/account-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface RequestPaymentInput {
  accountId: string;
}

export class RequestPaymentUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: RequestPaymentInput): Promise<Result<Account, Error>> {
    const account = await this.accountRepo.findById(input.accountId);
    if (!account) {
      return err(new Error('Account not found'));
    }

    const requested = account.requestPayment();
    if (!requested.success) {
      return err(requested.error);
    }

    await this.accountRepo.save(requested.value);
    await this.eventPublisher.publish('ACCOUNT_REQUESTED', {
      accountId: requested.value.id,
      restaurantId: requested.value.restaurantId,
      tableSessionId: requested.value.tableSessionId,
      totalAmount: requested.value.totalAmount,
    });

    return ok(requested.value);
  }
}
