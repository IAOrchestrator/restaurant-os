import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type TableSessionId = string;
export type WaiterId = string;

export enum TableSessionStatus {
  ASSIGNED = 'ASSIGNED',
  OCCUPIED = 'OCCUPIED',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
}

export interface WaiterAssignment {
  waiterId: WaiterId;
  assignedAt: Date;
  replacedAt?: Date;
}

export interface TableAssignment {
  tableId: string;
  assignedAt: Date;
  releasedAt?: Date;
}

export class TableSession extends Entity<TableSessionId> {
  private constructor(
    id: TableSessionId,
    public readonly restaurantId: string,
    private _tableAssignments: TableAssignment[],
    private _customerIds: string[],
    private _status: TableSessionStatus,
    private _waiterAssignments: WaiterAssignment[],
    public readonly openedAt: Date,
    private _closedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: TableSessionId;
    restaurantId: string;
    tableId: string;
    initialWaiterId: WaiterId;
    customerIds?: string[];
    tableAssignments?: TableAssignment[];
    waiterAssignments?: WaiterAssignment[];
    status?: TableSessionStatus;
    openedAt?: Date;
    closedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): Result<TableSession, TableSessionDomainError> {
    const now = new Date();
    const waiterAssignment: WaiterAssignment = {
      waiterId: props.initialWaiterId,
      assignedAt: now,
    };
    const tableAssignment: TableAssignment = {
      tableId: props.tableId,
      assignedAt: now,
    };

    return ok(
      new TableSession(
        props.id,
        props.restaurantId,
        props.tableAssignments && props.tableAssignments.length > 0
          ? props.tableAssignments
          : [tableAssignment],
        props.customerIds ?? [],
        props.status ?? TableSessionStatus.ASSIGNED,
        props.waiterAssignments && props.waiterAssignments.length > 0
          ? props.waiterAssignments
          : [waiterAssignment],
        props.openedAt ?? now,
        props.closedAt ?? null,
        props.createdAt ?? now,
        props.updatedAt ?? now,
      ),
    );
  }

  get tableId(): string {
    const current = this._tableAssignments.find((a) => !a.releasedAt);
    return current ? current.tableId : this._tableAssignments[this._tableAssignments.length - 1].tableId;
  }

  get tableAssignments(): ReadonlyArray<TableAssignment> {
    return Object.freeze([...this._tableAssignments]);
  }

  get tableHistory(): ReadonlyArray<TableAssignment> {
    return Object.freeze([...this._tableAssignments]);
  }

  get customerIds(): ReadonlyArray<string> {
    return Object.freeze([...this._customerIds]);
  }

  get status(): TableSessionStatus {
    return this._status;
  }

  get closedAt(): Date | null {
    return this._closedAt;
  }

  get currentWaiterId(): WaiterId | null {
    const current = this._waiterAssignments.find((a) => !a.replacedAt);
    return current?.waiterId ?? null;
  }

  get waiterAssignments(): ReadonlyArray<WaiterAssignment> {
    return Object.freeze([...this._waiterAssignments]);
  }

  occupy(): Result<TableSession, TableSessionDomainError> {
    if (this._status !== TableSessionStatus.ASSIGNED) {
      return err(
        new TableSessionDomainError(
          `Cannot occupy: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(TableSessionStatus.OCCUPIED));
  }

  open(): Result<TableSession, TableSessionDomainError> {
    if (this._status !== TableSessionStatus.OCCUPIED) {
      return err(
        new TableSessionDomainError(
          `Cannot open session: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(TableSessionStatus.OPEN));
  }

  requestClose(): Result<TableSession, TableSessionDomainError> {
    if (this._status !== TableSessionStatus.OPEN) {
      return err(
        new TableSessionDomainError(
          `Cannot request close: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(TableSessionStatus.CLOSING));
  }

  close(): Result<TableSession, TableSessionDomainError> {
    if (this._status !== TableSessionStatus.CLOSING) {
      return err(
        new TableSessionDomainError(
          `Cannot close: current status is ${this._status} (expected CLOSING)`,
        ),
      );
    }
    const now = new Date();
    return ok(
      new TableSession(
        this.id,
        this.restaurantId,
        this._tableAssignments,
        this._customerIds,
        TableSessionStatus.CLOSED,
        this._waiterAssignments,
        this.openedAt,
        now,
        this.createdAt,
        now,
      ),
    );
  }

  changeWaiter(newWaiterId: WaiterId): Result<TableSession, TableSessionDomainError> {
    if (this._status === TableSessionStatus.CLOSED) {
      return err(
        new TableSessionDomainError('Cannot change waiter: session is closed'),
      );
    }

    const now = new Date();
    const updatedAssignments = this._waiterAssignments.map((a) =>
      !a.replacedAt ? { ...a, replacedAt: now } : a,
    );
    updatedAssignments.push({ waiterId: newWaiterId, assignedAt: now });

    return ok(
      new TableSession(
        this.id,
        this.restaurantId,
        this._tableAssignments,
        this._customerIds,
        this._status,
        updatedAssignments,
        this.openedAt,
        this._closedAt,
        this.createdAt,
        now,
      ),
    );
  }

  changeTable(newTableId: string): Result<TableSession, TableSessionDomainError> {
    if (this._status === TableSessionStatus.CLOSED) {
      return err(
        new TableSessionDomainError('Cannot change table: session is closed'),
      );
    }

    if (this.tableId === newTableId) {
      return err(
        new TableSessionDomainError(`Cannot change table: already assigned to table ${newTableId}`),
      );
    }

    const now = new Date();
    const updatedAssignments = this._tableAssignments.map((a) =>
      !a.releasedAt ? { ...a, releasedAt: now } : a,
    );
    updatedAssignments.push({ tableId: newTableId, assignedAt: now });

    return ok(
      new TableSession(
        this.id,
        this.restaurantId,
        updatedAssignments,
        this._customerIds,
        this._status,
        this._waiterAssignments,
        this.openedAt,
        this._closedAt,
        this.createdAt,
        now,
      ),
    );
  }

  addCustomer(customerId: string): Result<TableSession, TableSessionDomainError> {
    if (this._status === TableSessionStatus.CLOSED) {
      return err(
        new TableSessionDomainError('Cannot add customer: session is closed'),
      );
    }

    if (this._customerIds.includes(customerId)) {
      return err(
        new TableSessionDomainError(`Customer ${customerId} is already part of this session`),
      );
    }

    const updatedCustomers = [...this._customerIds, customerId];
    return ok(
      new TableSession(
        this.id,
        this.restaurantId,
        this._tableAssignments,
        updatedCustomers,
        this._status,
        this._waiterAssignments,
        this.openedAt,
        this._closedAt,
        this.createdAt,
        new Date(),
      ),
    );
  }

  removeCustomer(customerId: string): Result<TableSession, TableSessionDomainError> {
    if (this._status === TableSessionStatus.CLOSED) {
      return err(
        new TableSessionDomainError('Cannot remove customer: session is closed'),
      );
    }

    if (!this._customerIds.includes(customerId)) {
      return err(
        new TableSessionDomainError(`Customer ${customerId} is not part of this session`),
      );
    }

    const updatedCustomers = this._customerIds.filter((id) => id !== customerId);
    return ok(
      new TableSession(
        this.id,
        this.restaurantId,
        this._tableAssignments,
        updatedCustomers,
        this._status,
        this._waiterAssignments,
        this.openedAt,
        this._closedAt,
        this.createdAt,
        new Date(),
      ),
    );
  }

  private withStatus(newStatus: TableSessionStatus): TableSession {
    return new TableSession(
      this.id,
      this.restaurantId,
      this._tableAssignments,
      this._customerIds,
      newStatus,
      this._waiterAssignments,
      this.openedAt,
      this._closedAt,
      this.createdAt,
      new Date(),
    );
  }
}

export class TableSessionDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TableSessionDomainError';
  }
}
