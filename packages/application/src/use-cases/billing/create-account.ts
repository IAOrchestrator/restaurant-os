import { Account } from '@restaurant-os/domain';
import type { AccountRepository } from '../../ports/account-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CreateAccountInput {
  id: string;
  restaurantId: string;
  tableSessionId: string;
}

export class CreateAccountUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateAccountInput): Promise<Result<Account, Error>> {
    const existing = await this.accountRepo.findByTableSessionId(input.tableSessionId);
    if (existing) {
      return err(new Error('Account already exists for this table session'));
    }

    const accountResult = Account.create({
      id: input.id,
      restaurantId: input.restaurantId,
      tableSessionId: input.tableSessionId,
    });

    if (!accountResult.success) {
      return err(accountResult.error);
    }

    await this.accountRepo.save(accountResult.value);
    await this.eventPublisher.publish('ACCOUNT_REQUESTED', {
      accountId: accountResult.value.id,
      restaurantId: accountResult.value.restaurantId,
      tableSessionId: accountResult.value.tableSessionId,
    });

    return ok(accountResult.value);
  }
}
