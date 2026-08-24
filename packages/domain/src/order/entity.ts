import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type OrderId = string;

export enum OrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  SENT_TO_KITCHEN = 'SENT_TO_KITCHEN',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export class Order extends Entity<OrderId> {
  private constructor(
    id: OrderId,
    public readonly restaurantId: string,
    public readonly tableSessionId: string,
    public readonly customerId: string | null,
    private _status: OrderStatus,
    private _items: OrderItem[],
    public readonly type: OrderType = 'DINE_IN',
    private _isPaid: boolean = false,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {
    super(id);
  }

  static create(props: {
    id: OrderId;
    restaurantId: string;
    tableSessionId: string;
    customerId?: string | null;
    items?: OrderItem[];
    type?: OrderType;
    isPaid?: boolean;
    createdAt?: Date;
  }): Result<Order, OrderDomainError> {
    const now = props.createdAt ?? new Date();
    return ok(
      new Order(
        props.id,
        props.restaurantId,
        props.tableSessionId,
        props.customerId ?? null,
        OrderStatus.DRAFT,
        props.items ?? [],
        props.type ?? 'DINE_IN',
        props.isPaid ?? false,
        now,
        now,
      ),
    );
  }

  get isPaid(): boolean {
    return this._isPaid;
  }

  get status(): OrderStatus {
    return this._status;
  }

  get items(): ReadonlyArray<OrderItem> {
    return Object.freeze([...this._items]);
  }

  get totalAmount(): number {
    return this._items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }

  addItem(item: OrderItem): Result<Order, OrderDomainError> {
    if (this._status !== OrderStatus.DRAFT) {
      return err(
        new OrderDomainError(
          `Cannot add items: current status is ${this._status}`,
        ),
      );
    }
    if (item.quantity <= 0) {
      return err(new OrderDomainError('Item quantity must be positive'));
    }
    if (item.unitPrice < 0) {
      return err(new OrderDomainError('Item unit price cannot be negative'));
    }
    return ok(
      new Order(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        this.customerId,
        this._status,
        [...this._items, item],
        this.type,
        this._isPaid,
        this.createdAt,
        new Date(),
      ),
    );
  }

  removeItem(productId: string): Result<Order, OrderDomainError> {
    if (this._status !== OrderStatus.DRAFT) {
      return err(
        new OrderDomainError(
          `Cannot remove items: current status is ${this._status}`,
        ),
      );
    }
    const filtered = this._items.filter((i) => i.productId !== productId);
    if (filtered.length === this._items.length) {
      return err(new OrderDomainError('Item not found'));
    }
    return ok(
      new Order(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        this.customerId,
        this._status,
        filtered,
        this.type,
        this._isPaid,
        this.createdAt,
        new Date(),
      ),
    );
  }

  confirm(): Result<Order, OrderDomainError> {
    if (this._status !== OrderStatus.DRAFT) {
      return err(
        new OrderDomainError(
          `Cannot confirm: current status is ${this._status} (expected DRAFT)`,
        ),
      );
    }
    if (this._items.length === 0) {
      return err(new OrderDomainError('Cannot confirm an empty order'));
    }
    return ok(this.withStatus(OrderStatus.CONFIRMED));
  }

  sendToKitchen(): Result<Order, OrderDomainError> {
    if (this._status !== OrderStatus.CONFIRMED) {
      return err(
        new OrderDomainError(
          `Cannot send to kitchen: current status is ${this._status} (expected CONFIRMED)`,
        ),
      );
    }
    return ok(this.withStatus(OrderStatus.SENT_TO_KITCHEN));
  }

  startPreparing(): Result<Order, OrderDomainError> {
    if (this._status !== OrderStatus.SENT_TO_KITCHEN) {
      return err(
        new OrderDomainError(
          `Cannot start preparing: current status is ${this._status} (expected SENT_TO_KITCHEN)`,
        ),
      );
    }
    return ok(this.withStatus(OrderStatus.PREPARING));
  }

  markReady(): Result<Order, OrderDomainError> {
    if (this._status !== OrderStatus.PREPARING) {
      return err(
        new OrderDomainError(
          `Cannot mark ready: current status is ${this._status} (expected PREPARING)`,
        ),
      );
    }
    return ok(this.withStatus(OrderStatus.READY));
  }

  deliver(): Result<Order, OrderDomainError> {
    if (this._status !== OrderStatus.READY) {
      return err(
        new OrderDomainError(
          `Cannot deliver: current status is ${this._status} (expected READY)`,
        ),
      );
    }
    return ok(this.withStatus(OrderStatus.DELIVERED));
  }

  cancel(): Result<Order, OrderDomainError> {
    if (
      this._status === OrderStatus.DELIVERED ||
      this._status === OrderStatus.CANCELLED
    ) {
      return err(
        new OrderDomainError(
          `Cannot cancel: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(OrderStatus.CANCELLED));
  }

  markAsPaid(): Result<Order, OrderDomainError> {
    return ok(
      new Order(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        this.customerId,
        this._status,
        this._items,
        this.type,
        true,
        this.createdAt,
        new Date(),
      ),
    );
  }

  private withStatus(newStatus: OrderStatus): Order {
    return new Order(
      this.id,
      this.restaurantId,
      this.tableSessionId,
      this.customerId,
      newStatus,
      this._items,
      this.type,
      this._isPaid,
      this.createdAt,
      new Date(),
    );
  }
}

export class OrderDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderDomainError';
  }
}
