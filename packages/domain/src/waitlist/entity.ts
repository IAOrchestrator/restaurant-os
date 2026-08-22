import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type WaitlistEntryId = string;

export enum WaitlistStatus {
  PREPARED = 'PREPARED',
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  CUSTOMER_CONFIRMED = 'CUSTOMER_CONFIRMED',
  WAITING_FOR_SEATING = 'WAITING_FOR_SEATING',
  SEATED = 'SEATED',
  CANCELLED = 'CANCELLED',
  TAKEAWAY = 'TAKEAWAY',
  EXPIRED = 'EXPIRED',
  NO_SHOW = 'NO_SHOW',
}

export class WaitlistEntry extends Entity<WaitlistEntryId> {
  private constructor(
    id: WaitlistEntryId,
    public readonly restaurantId: string,
    public readonly customerId: string,
    public readonly partySize: number,
    private _status: WaitlistStatus,
    public readonly enteredAt: Date,
    private _calledAt: Date | null,
    private _seatedAt: Date | null,
    private _cancelledAt: Date | null,
    private _preOrderId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: WaitlistEntryId;
    restaurantId: string;
    customerId: string;
    partySize: number;
    status?: WaitlistStatus;
    preOrderId?: string | null;
    createdAt?: Date;
  }): Result<WaitlistEntry, WaitlistDomainError> {
    if (props.partySize <= 0) {
      return err(new WaitlistDomainError('Party size must be positive'));
    }

    const now = props.createdAt ?? new Date();
    return ok(
      new WaitlistEntry(
        props.id,
        props.restaurantId,
        props.customerId,
        props.partySize,
        props.status ?? WaitlistStatus.PREPARED,
        now,
        null,
        null,
        null,
        props.preOrderId ?? null,
        now,
        now,
      ),
    );
  }

  get status(): WaitlistStatus {
    return this._status;
  }

  get calledAt(): Date | null {
    return this._calledAt;
  }

  get seatedAt(): Date | null {
    return this._seatedAt;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  get preOrderId(): string | null {
    return this._preOrderId;
  }

  // Transitions

  joinQueue(): Result<WaitlistEntry, WaitlistDomainError> {
    if (this._status !== WaitlistStatus.PREPARED) {
      return err(
        new WaitlistDomainError(
          `Cannot join queue: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(WaitlistStatus.WAITING));
  }

  call(): Result<WaitlistEntry, WaitlistDomainError> {
    if (this._status !== WaitlistStatus.WAITING) {
      return err(
        new WaitlistDomainError(
          `Cannot call: current status is ${this._status} (expected WAITING)`,
        ),
      );
    }
    return ok(
      new WaitlistEntry(
        this.id,
        this.restaurantId,
        this.customerId,
        this.partySize,
        WaitlistStatus.CALLED,
        this.enteredAt,
        new Date(),
        this._seatedAt,
        this._cancelledAt,
        this._preOrderId,
        this.createdAt,
        new Date(),
      ),
    );
  }

  confirm(): Result<WaitlistEntry, WaitlistDomainError> {
    if (this._status !== WaitlistStatus.CALLED) {
      return err(
        new WaitlistDomainError(
          `Cannot confirm: current status is ${this._status} (expected CALLED)`,
        ),
      );
    }
    return ok(this.withStatus(WaitlistStatus.CUSTOMER_CONFIRMED));
  }

  markWaitingForSeating(): Result<WaitlistEntry, WaitlistDomainError> {
    if (this._status !== WaitlistStatus.CUSTOMER_CONFIRMED) {
      return err(
        new WaitlistDomainError(
          `Cannot mark waiting for seating: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(WaitlistStatus.WAITING_FOR_SEATING));
  }

  seat(): Result<WaitlistEntry, WaitlistDomainError> {
    if (this._status !== WaitlistStatus.WAITING_FOR_SEATING) {
      return err(
        new WaitlistDomainError(
          `Cannot seat: current status is ${this._status} (expected WAITING_FOR_SEATING)`,
        ),
      );
    }
    return ok(
      new WaitlistEntry(
        this.id,
        this.restaurantId,
        this.customerId,
        this.partySize,
        WaitlistStatus.SEATED,
        this.enteredAt,
        this._calledAt,
        new Date(),
        this._cancelledAt,
        this._preOrderId,
        this.createdAt,
        new Date(),
      ),
    );
  }

  cancel(): Result<WaitlistEntry, WaitlistDomainError> {
    if (
      this._status !== WaitlistStatus.WAITING &&
      this._status !== WaitlistStatus.CALLED &&
      this._status !== WaitlistStatus.CUSTOMER_CONFIRMED &&
      this._status !== WaitlistStatus.WAITING_FOR_SEATING
    ) {
      return err(
        new WaitlistDomainError(
          `Cannot cancel: current status is ${this._status}`,
        ),
      );
    }
    return ok(
      new WaitlistEntry(
        this.id,
        this.restaurantId,
        this.customerId,
        this.partySize,
        WaitlistStatus.CANCELLED,
        this.enteredAt,
        this._calledAt,
        this._seatedAt,
        new Date(),
        this._preOrderId,
        this.createdAt,
        new Date(),
      ),
    );
  }

  selectTakeaway(): Result<WaitlistEntry, WaitlistDomainError> {
    if (
      this._status !== WaitlistStatus.WAITING &&
      this._status !== WaitlistStatus.CALLED &&
      this._status !== WaitlistStatus.CUSTOMER_CONFIRMED
    ) {
      return err(
        new WaitlistDomainError(
          `Cannot select takeaway: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(WaitlistStatus.TAKEAWAY));
  }

  expire(): Result<WaitlistEntry, WaitlistDomainError> {
    if (this._status !== WaitlistStatus.CALLED) {
      return err(
        new WaitlistDomainError(
          `Cannot expire: current status is ${this._status} (expected CALLED)`,
        ),
      );
    }
    return ok(this.withStatus(WaitlistStatus.EXPIRED));
  }

  markNoShow(): Result<WaitlistEntry, WaitlistDomainError> {
    if (this._status !== WaitlistStatus.CALLED) {
      return err(
        new WaitlistDomainError(
          `Cannot mark no-show: current status is ${this._status} (expected CALLED)`,
        ),
      );
    }
    return ok(this.withStatus(WaitlistStatus.NO_SHOW));
  }

  private withStatus(newStatus: WaitlistStatus): WaitlistEntry {
    return new WaitlistEntry(
      this.id,
      this.restaurantId,
      this.customerId,
      this.partySize,
      newStatus,
      this.enteredAt,
      this._calledAt,
      this._seatedAt,
      this._cancelledAt,
      this._preOrderId,
      this.createdAt,
      new Date(),
    );
  }
}

export class WaitlistDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaitlistDomainError';
  }
}
