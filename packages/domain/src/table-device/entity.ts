import { Result, ok, err } from '../shared/result';

export class TableDeviceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TableDeviceDomainError';
  }
}

export interface CreateTableDeviceProps {
  id: string;
  restaurantId: string;
  name: string;
  tableId?: string | null;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TableDevice {
  private constructor(
    private readonly _id: string,
    private readonly _restaurantId: string,
    private _name: string,
    private _tableId: string | null,
    private _active: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(props: CreateTableDeviceProps): Result<TableDevice, TableDeviceDomainError> {
    if (!props.id || props.id.trim().length === 0) {
      return err(new TableDeviceDomainError('TableDevice ID is required'));
    }
    if (!props.restaurantId || props.restaurantId.trim().length === 0) {
      return err(new TableDeviceDomainError('Restaurant ID is required'));
    }
    if (!props.name || props.name.trim().length === 0) {
      return err(new TableDeviceDomainError('Device name is required'));
    }

    const now = new Date();
    return ok(
      new TableDevice(
        props.id,
        props.restaurantId,
        props.name.trim(),
        props.tableId ?? null,
        props.active ?? true,
        props.createdAt ?? now,
        props.updatedAt ?? now,
      ),
    );
  }

  get id(): string { return this._id; }
  get restaurantId(): string { return this._restaurantId; }
  get name(): string { return this._name; }
  get tableId(): string | null { return this._tableId; }
  get active(): boolean { return this._active; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  associateTable(tableId: string): Result<TableDevice, TableDeviceDomainError> {
    if (!tableId || tableId.trim().length === 0) {
      return err(new TableDeviceDomainError('Table ID is required for association'));
    }
    if (this._tableId === tableId) {
      return ok(this);
    }
    this._tableId = tableId;
    this._updatedAt = new Date();
    return ok(this);
  }

  disassociateTable(): Result<TableDevice, TableDeviceDomainError> {
    if (this._tableId === null) {
      return ok(this);
    }
    this._tableId = null;
    this._updatedAt = new Date();
    return ok(this);
  }

  updateName(name: string): Result<TableDevice, TableDeviceDomainError> {
    if (!name || name.trim().length === 0) {
      return err(new TableDeviceDomainError('Device name cannot be empty'));
    }
    this._name = name.trim();
    this._updatedAt = new Date();
    return ok(this);
  }

  activate(): Result<TableDevice, TableDeviceDomainError> {
    this._active = true;
    this._updatedAt = new Date();
    return ok(this);
  }

  deactivate(): Result<TableDevice, TableDeviceDomainError> {
    this._active = false;
    this._updatedAt = new Date();
    return ok(this);
  }
}
