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
import type { EventPublisher } from '../../ports/event-publisher';

export interface CreateAccountInput {
  id: string;
  restaurantId: string;
  tableSessionId: string;
  actorType?: ActorType;
  actorId?: string | null;
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

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.ACCOUNT_REQUESTED,
        restaurantId: accountResult.value.restaurantId,
        aggregateType: 'Account',
        aggregateId: accountResult.value.id,
        tableSessionId: accountResult.value.tableSessionId,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          accountId: accountResult.value.id,
          restaurantId: accountResult.value.restaurantId,
          tableSessionId: accountResult.value.tableSessionId,
          totalAmount: accountResult.value.totalAmount,
        },
      }),
    );

    return ok(accountResult.value);
  }
}
