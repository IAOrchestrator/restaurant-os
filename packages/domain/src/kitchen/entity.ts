import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type KitchenOrderId = string;

export enum KitchenOrderStatus {
  RECEIVED = 'RECEIVED',
  STARTED = 'STARTED',
  NEARLY_READY = 'NEARLY_READY',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
}

export class KitchenOrder extends Entity<KitchenOrderId> {
  private constructor(
    id: KitchenOrderId,
    public readonly restaurantId: string,
    public readonly orderId: string,
    private _status: KitchenOrderStatus,
    private _assignedTo: string | null,
    private _priority: number,
    public readonly receivedAt: Date,
    private _startedAt: Date | null,
    private _nearlyReadyAt: Date | null,
    private _readyAt: Date | null,
    private _completedAt: Date | null,
    private _notes: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: KitchenOrderId;
    restaurantId: string;
    orderId: string;
    assignedTo?: string | null;
    priority?: number;
    notes?: string | null;
    createdAt?: Date;
  }): Result<KitchenOrder, KitchenDomainError> {
    const now = props.createdAt ?? new Date();
    return ok(
      new KitchenOrder(
        props.id,
        props.restaurantId,
        props.orderId,
        KitchenOrderStatus.RECEIVED,
        props.assignedTo ?? null,
        props.priority ?? 0,
        now,
        null,
        null,
        null,
        null,
        props.notes ?? null,
        now,
        now,
      ),
    );
  }

  get status(): KitchenOrderStatus {
    return this._status;
  }

  get assignedTo(): string | null {
    return this._assignedTo;
  }

  get priority(): number {
    return this._priority;
  }

  get startedAt(): Date | null {
    return this._startedAt;
  }

  get nearlyReadyAt(): Date | null {
    return this._nearlyReadyAt;
  }

  get readyAt(): Date | null {
    return this._readyAt;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  get notes(): string | null {
    return this._notes;
  }

  assign(staffId: string): Result<KitchenOrder, KitchenDomainError> {
    if (this._status === KitchenOrderStatus.COMPLETED) {
      return err(new KitchenDomainError('Cannot assign: order is completed'));
    }
    return ok(
      new KitchenOrder(
        this.id,
        this.restaurantId,
        this.orderId,
        this._status,
        staffId,
        this._priority,
        this.receivedAt,
        this._startedAt,
        this._nearlyReadyAt,
        this._readyAt,
        this._completedAt,
        this._notes,
        this.createdAt,
        new Date(),
      ),
    );
  }

  start(): Result<KitchenOrder, KitchenDomainError> {
    if (this._status !== KitchenOrderStatus.RECEIVED) {
      return err(
        new KitchenDomainError(
          `Cannot start: current status is ${this._status} (expected RECEIVED)`,
        ),
      );
    }
    return ok(
      new KitchenOrder(
        this.id,
        this.restaurantId,
        this.orderId,
        KitchenOrderStatus.STARTED,
        this._assignedTo,
        this._priority,
        this.receivedAt,
        new Date(),
        this._nearlyReadyAt,
        this._readyAt,
        this._completedAt,
        this._notes,
        this.createdAt,
        new Date(),
      ),
    );
  }

  markNearlyReady(): Result<KitchenOrder, KitchenDomainError> {
    if (this._status !== KitchenOrderStatus.STARTED) {
      return err(
        new KitchenDomainError(
          `Cannot mark nearly ready: current status is ${this._status} (expected STARTED)`,
        ),
      );
    }
    return ok(
      new KitchenOrder(
        this.id,
        this.restaurantId,
        this.orderId,
        KitchenOrderStatus.NEARLY_READY,
        this._assignedTo,
        this._priority,
        this.receivedAt,
        this._startedAt,
        new Date(),
        this._readyAt,
        this._completedAt,
        this._notes,
        this.createdAt,
        new Date(),
      ),
    );
  }

  markReady(): Result<KitchenOrder, KitchenDomainError> {
    if (this._status !== KitchenOrderStatus.STARTED && this._status !== KitchenOrderStatus.NEARLY_READY) {
      return err(
        new KitchenDomainError(
          `Cannot mark ready: current status is ${this._status} (expected STARTED or NEARLY_READY)`,
        ),
      );
    }
    return ok(
      new KitchenOrder(
        this.id,
        this.restaurantId,
        this.orderId,
        KitchenOrderStatus.READY,
        this._assignedTo,
        this._priority,
        this.receivedAt,
        this._startedAt,
        this._nearlyReadyAt,
        new Date(),
        this._completedAt,
        this._notes,
        this.createdAt,
        new Date(),
      ),
    );
  }

  complete(): Result<KitchenOrder, KitchenDomainError> {
    if (this._status !== KitchenOrderStatus.READY) {
      return err(
        new KitchenDomainError(
          `Cannot complete: current status is ${this._status} (expected READY)`,
        ),
      );
    }
    return ok(
      new KitchenOrder(
        this.id,
        this.restaurantId,
        this.orderId,
        KitchenOrderStatus.COMPLETED,
        this._assignedTo,
        this._priority,
        this.receivedAt,
        this._startedAt,
        this._nearlyReadyAt,
        this._readyAt,
        new Date(),
        this._notes,
        this.createdAt,
        new Date(),
      ),
    );
  }

  setPriority(priority: number): Result<KitchenOrder, KitchenDomainError> {
    if (this._status === KitchenOrderStatus.COMPLETED) {
      return err(new KitchenDomainError('Cannot change priority: order is completed'));
    }
    if (priority < 0) {
      return err(new KitchenDomainError('Priority cannot be negative'));
    }
    return ok(
      new KitchenOrder(
        this.id,
        this.restaurantId,
        this.orderId,
        this._status,
        this._assignedTo,
        priority,
        this.receivedAt,
        this._startedAt,
        this._nearlyReadyAt,
        this._readyAt,
        this._completedAt,
        this._notes,
        this.createdAt,
        new Date(),
      ),
    );
  }

  addNotes(notes: string): Result<KitchenOrder, KitchenDomainError> {
    if (this._status === KitchenOrderStatus.COMPLETED) {
      return err(new KitchenDomainError('Cannot add notes: order is completed'));
    }
    return ok(
      new KitchenOrder(
        this.id,
        this.restaurantId,
        this.orderId,
        this._status,
        this._assignedTo,
        this._priority,
        this.receivedAt,
        this._startedAt,
        this._nearlyReadyAt,
        this._readyAt,
        this._completedAt,
        notes,
        this.createdAt,
        new Date(),
      ),
    );
  }

  get preparationTimeMs(): number | null {
    if (!this._startedAt) return null;
    const end = this._readyAt ?? this._completedAt ?? new Date();
    return end.getTime() - this._startedAt.getTime();
  }

  get totalKitchenTimeMs(): number | null {
    const end = this._completedAt ?? this._readyAt ?? new Date();
    return end.getTime() - this.receivedAt.getTime();
  }
}

export class KitchenDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KitchenDomainError';
  }
}
