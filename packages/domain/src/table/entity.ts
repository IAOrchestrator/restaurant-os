import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type TableId = string;
export type RestaurantId = string;

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  OCCUPIED = 'OCCUPIED',
}

export class Table extends Entity<TableId> {
  private constructor(
    id: TableId,
    public readonly restaurantId: RestaurantId,
    public readonly number: number,
    public readonly capacity: number,
    private _status: TableStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(
    props: {
      id: TableId;
      restaurantId: RestaurantId;
      number: number;
      capacity: number;
      status?: TableStatus;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): Result<Table, TableDomainError> {
    if (props.number <= 0) {
      return err(new TableDomainError('Table number must be positive'));
    }
    if (props.capacity <= 0) {
      return err(new TableDomainError('Table capacity must be positive'));
    }

    return ok(
      new Table(
        props.id,
        props.restaurantId,
        props.number,
        props.capacity,
        props.status ?? TableStatus.AVAILABLE,
        props.createdAt ?? new Date(),
        props.updatedAt ?? new Date(),
      ),
    );
  }

  get status(): TableStatus {
    return this._status;
  }

  assign(): Result<Table, TableDomainError> {
    if (this._status !== TableStatus.AVAILABLE) {
      return err(
        new TableDomainError(
          `Cannot assign table: current status is ${this._status}`,
        ),
      );
    }
    return ok(this.withStatus(TableStatus.ASSIGNED));
  }

  occupy(): Result<Table, TableDomainError> {
    if (this._status !== TableStatus.ASSIGNED && this._status !== TableStatus.AVAILABLE) {
      return err(
        new TableDomainError(
          `Cannot occupy table: current status is ${this._status} (expected ASSIGNED or AVAILABLE)`,
        ),
      );
    }
    return ok(this.withStatus(TableStatus.OCCUPIED));
  }

  release(): Result<Table, TableDomainError> {
    if (this._status !== TableStatus.OCCUPIED && this._status !== TableStatus.ASSIGNED) {
      return err(
        new TableDomainError(
          `Cannot release table: current status is ${this._status} (expected ASSIGNED or OCCUPIED)`,
        ),
      );
    }
    return ok(this.withStatus(TableStatus.AVAILABLE));
  }

  private withStatus(newStatus: TableStatus): Table {
    return new Table(
      this.id,
      this.restaurantId,
      this.number,
      this.capacity,
      newStatus,
      this.createdAt,
      new Date(),
    );
  }
}

export class TableDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TableDomainError';
  }
}
