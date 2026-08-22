import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type AccountId = string;

export enum AccountStatus {
  OPEN = 'OPEN',
  REQUESTED = 'REQUESTED',
  PAID = 'PAID',
  CLOSED = 'CLOSED',
}

export class Account extends Entity<AccountId> {
  private constructor(
    id: AccountId,
    public readonly restaurantId: string,
    public readonly tableSessionId: string,
    private _status: AccountStatus,
    private _totalAmount: number,
    private _payments: PaymentRecord[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: AccountId;
    restaurantId: string;
    tableSessionId: string;
    createdAt?: Date;
  }): Result<Account, AccountDomainError> {
    const now = props.createdAt ?? new Date();
    return ok(
      new Account(
        props.id,
        props.restaurantId,
        props.tableSessionId,
        AccountStatus.OPEN,
        0,
        [],
        now,
        now,
      ),
    );
  }

  get status(): AccountStatus {
    return this._status;
  }

  get totalAmount(): number {
    return this._totalAmount;
  }

  get paidAmount(): number {
    return this._payments.reduce((sum, p) => sum + p.amount, 0);
  }

  get remainingAmount(): number {
    return Math.max(0, this._totalAmount - this.paidAmount);
  }

  get isFullyPaid(): boolean {
    return this.paidAmount >= this._totalAmount;
  }

  get payments(): ReadonlyArray<PaymentRecord> {
    return Object.freeze([...this._payments]);
  }

  addOrderAmount(amount: number): Result<Account, AccountDomainError> {
    if (this._status !== AccountStatus.OPEN) {
      return err(
        new AccountDomainError(
          `Cannot add order amount: current status is ${this._status}`,
        ),
      );
    }
    if (amount < 0) {
      return err(new AccountDomainError('Order amount cannot be negative'));
    }
    return ok(
      new Account(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        this._status,
        this._totalAmount + amount,
        this._payments,
        this.createdAt,
        new Date(),
      ),
    );
  }

  requestPayment(): Result<Account, AccountDomainError> {
    if (this._status !== AccountStatus.OPEN) {
      return err(
        new AccountDomainError(
          `Cannot request payment: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(AccountStatus.REQUESTED));
  }

  registerPayment(payment: PaymentRecord): Result<Account, AccountDomainError> {
    if (this._status !== AccountStatus.REQUESTED && this._status !== AccountStatus.OPEN) {
      return err(
        new AccountDomainError(
          `Cannot register payment: current status is ${this._status}`,
        ),
      );
    }
    if (payment.amount <= 0) {
      return err(new AccountDomainError('Payment amount must be positive'));
    }

    const newPayments = [...this._payments, payment];
    const newPaidAmount = newPayments.reduce((sum, p) => sum + p.amount, 0);
    const newStatus = newPaidAmount >= this._totalAmount ? AccountStatus.PAID : this._status;

    return ok(
      new Account(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        newStatus,
        this._totalAmount,
        newPayments,
        this.createdAt,
        new Date(),
      ),
    );
  }

  close(): Result<Account, AccountDomainError> {
    if (this._status !== AccountStatus.PAID) {
      return err(
        new AccountDomainError(
          `Cannot close account: current status is ${this._status} (expected PAID)`,
        ),
      );
    }
    return ok(this.withStatus(AccountStatus.CLOSED));
  }

  private withStatus(newStatus: AccountStatus): Account {
    return new Account(
      this.id,
      this.restaurantId,
      this.tableSessionId,
      newStatus,
      this._totalAmount,
      this._payments,
      this.createdAt,
      new Date(),
    );
  }
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  registeredAt: Date;
}

export class AccountDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountDomainError';
  }
}
