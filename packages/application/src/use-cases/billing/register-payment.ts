import { Account } from '@restaurant-os/domain';
import type { AccountRepository } from '../../ports/account-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface RegisterPaymentInput {
  accountId: string;
  paymentId: string;
  amount: number;
  method: string;
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
    await this.eventPublisher.publish('PAYMENT_REGISTERED', {
      accountId: updated.value.id,
      paymentId: input.paymentId,
      amount: input.amount,
      method: input.method,
      remainingAmount: updated.value.remainingAmount,
      isFullyPaid: updated.value.isFullyPaid,
    });

    return ok(updated.value);
  }
}
