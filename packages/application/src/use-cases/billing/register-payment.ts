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

export interface RegisterPaymentInput {
  accountId: string;
  paymentId: string;
  amount: number;
  method: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class RegisterPaymentUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: RegisterPaymentInput): Promise<Result<Account, Error>> {
    const account = await this.accountRepo.findById(input.accountId);
    if (!account) {
      return err(new Error('Account not found'));
    }

    const payment = {
      id: input.paymentId,
      amount: input.amount,
      method: input.method,
      registeredAt: new Date(),
    };

    const updated = account.registerPayment(payment);
    if (!updated.success) {
      return err(updated.error);
    }

    await this.accountRepo.save(updated.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.PAYMENT_REGISTERED,
        restaurantId: updated.value.restaurantId,
        aggregateType: 'Account',
        aggregateId: updated.value.id,
        tableSessionId: updated.value.tableSessionId,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          accountId: updated.value.id,
          paymentId: input.paymentId,
          amount: input.amount,
          method: input.method,
          remainingAmount: updated.value.remainingAmount,
          isFullyPaid: updated.value.isFullyPaid,
        },
      }),
    );

    return ok(updated.value);
  }
}
