import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type PreOrderId = string;

export enum PreOrderStatus {
  DRAFT = 'DRAFT',
  READY = 'READY',
  REVIEWING = 'REVIEWING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export interface PreOrderItem {
  productId: string;
  quantity: number;
  notes?: string;
}

export class PreOrder extends Entity<PreOrderId> {
  private constructor(
    id: PreOrderId,
    public readonly restaurantId: string,
    public readonly customerId: string,
    private _status: PreOrderStatus,
    private _items: PreOrderItem[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: PreOrderId;
    restaurantId: string;
    customerId: string;
    items?: PreOrderItem[];
    createdAt?: Date;
  }): Result<PreOrder, PreOrderDomainError> {
    const now = props.createdAt ?? new Date();
    return ok(
      new PreOrder(
        props.id,
        props.restaurantId,
        props.customerId,
        PreOrderStatus.DRAFT,
        props.items ?? [],
        now,
        now,
      ),
    );
  }

  get status(): PreOrderStatus {
    return this._status;
  }

  get items(): ReadonlyArray<PreOrderItem> {
    return Object.freeze([...this._items]);
  }

  addItem(item: PreOrderItem): Result<PreOrder, PreOrderDomainError> {
    if (this._status !== PreOrderStatus.DRAFT) {
      return err(
        new PreOrderDomainError(
          `Cannot add items: current status is ${this._status}`,
        ),
      );
    }
    if (item.quantity <= 0) {
      return err(new PreOrderDomainError('Item quantity must be positive'));
    }
    return ok(
      new PreOrder(
        this.id,
        this.restaurantId,
        this.customerId,
        this._status,
        [...this._items, item],
        this.createdAt,
        new Date(),
      ),
    );
  }

  removeItem(productId: string): Result<PreOrder, PreOrderDomainError> {
    if (this._status !== PreOrderStatus.DRAFT) {
      return err(
        new PreOrderDomainError(
          `Cannot remove items: current status is ${this._status}`,
        ),
      );
    }
    const filtered = this._items.filter((i) => i.productId !== productId);
    if (filtered.length === this._items.length) {
      return err(new PreOrderDomainError('Item not found'));
    }
    return ok(
      new PreOrder(
        this.id,
        this.restaurantId,
        this.customerId,
        this._status,
        filtered,
        this.createdAt,
        new Date(),
      ),
    );
  }

  markReady(): Result<PreOrder, PreOrderDomainError> {
    if (this._status !== PreOrderStatus.DRAFT) {
      return err(
        new PreOrderDomainError(
          `Cannot mark ready: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(PreOrderStatus.READY));
  }

  startReview(): Result<PreOrder, PreOrderDomainError> {
    if (this._status !== PreOrderStatus.READY) {
      return err(
        new PreOrderDomainError(
          `Cannot start review: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(PreOrderStatus.REVIEWING));
  }

  confirm(): Result<PreOrder, PreOrderDomainError> {
    if (this._status === PreOrderStatus.CANCELLED || this._status === PreOrderStatus.CONFIRMED) {
      return err(
        new PreOrderDomainError(
          `Cannot confirm: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(PreOrderStatus.CONFIRMED));
  }

  cancel(): Result<PreOrder, PreOrderDomainError> {
    if (
      this._status !== PreOrderStatus.DRAFT &&
      this._status !== PreOrderStatus.READY &&
      this._status !== PreOrderStatus.REVIEWING
    ) {
      return err(
        new PreOrderDomainError(
          `Cannot cancel: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(PreOrderStatus.CANCELLED));
  }

  private withStatus(newStatus: PreOrderStatus): PreOrder {
    return new PreOrder(
      this.id,
      this.restaurantId,
      this.customerId,
      newStatus,
      this._items,
      this.createdAt,
      new Date(),
    );
  }
}

export class PreOrderDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreOrderDomainError';
  }
}
