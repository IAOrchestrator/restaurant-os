import { Account } from '@restaurant-os/domain';
import type { AccountRepository } from '../../ports/account-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CloseAccountInput {
  accountId: string;
}

export class CloseAccountUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CloseAccountInput): Promise<Result<Account, Error>> {
    const account = await this.accountRepo.findById(input.accountId);
    if (!account) {
      return err(new Error('Account not found'));
    }

    const closed = account.close();
    if (!closed.success) {
      return err(closed.error);
    }

    await this.accountRepo.save(closed.value);
    await this.eventPublisher.publish('TABLE_CLOSED', {
      accountId: closed.value.id,
      restaurantId: closed.value.restaurantId,
      tableSessionId: closed.value.tableSessionId,
      totalPaid: closed.value.paidAmount,
    });

    return ok(closed.value);
  }
}
