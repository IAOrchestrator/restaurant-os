import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type ServiceTaskId = string;

export enum ServiceTaskType {
  TAKE_ORDER = 'TAKE_ORDER',
  SERVE_FOOD = 'SERVE_FOOD',
  CHECK_ACCOUNT = 'CHECK_ACCOUNT',
  CLEAN_TABLE = 'CLEAN_TABLE',
  DELIVER_ORDER = 'DELIVER_ORDER',
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
}

export enum ServiceTaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class ServiceTask extends Entity<ServiceTaskId> {
  private constructor(
    id: ServiceTaskId,
    public readonly restaurantId: string,
    public readonly tableSessionId: string | null,
    private _type: ServiceTaskType,
    private _status: ServiceTaskStatus,
    private _assignedTo: string | null,
    private _notes: string | null,
    public readonly createdAt: Date,
    private _assignedAt: Date | null,
    private _startedAt: Date | null,
    private _completedAt: Date | null,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: ServiceTaskId;
    restaurantId: string;
    tableSessionId?: string | null;
    type: ServiceTaskType | string;
    notes?: string | null;
    createdAt?: Date;
  }): Result<ServiceTask, ServiceDomainError> {
    if (!props.restaurantId || props.restaurantId.trim().length === 0) {
      return err(new ServiceDomainError('restaurantId is required'));
    }
    if (!props.type || String(props.type).trim().length === 0) {
      return err(new ServiceDomainError('type is required'));
    }

    const now = props.createdAt ?? new Date();
    return ok(
      new ServiceTask(
        props.id,
        props.restaurantId,
        props.tableSessionId ?? null,
        props.type as ServiceTaskType,
        ServiceTaskStatus.PENDING,
        null,
        props.notes ?? null,
        now,
        null,
        null,
        null,
        now,
      ),
    );
  }

  get type(): ServiceTaskType {
    return this._type;
  }

  get status(): ServiceTaskStatus {
    return this._status;
  }

  get assignedTo(): string | null {
    return this._assignedTo;
  }

  get notes(): string | null {
    return this._notes;
  }

  get assignedAt(): Date | null {
    return this._assignedAt;
  }

  get startedAt(): Date | null {
    return this._startedAt;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  assign(staffId: string): Result<ServiceTask, ServiceDomainError> {
    if (this._status !== ServiceTaskStatus.PENDING) {
      return err(
        new ServiceDomainError(
          `Cannot assign: current status is ${this._status} (expected PENDING)`,
        ),
      );
    }
    return ok(
      new ServiceTask(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        this._type,
        ServiceTaskStatus.ASSIGNED,
        staffId,
        this._notes,
        this.createdAt,
        new Date(),
        this._startedAt,
        this._completedAt,
        new Date(),
      ),
    );
  }

  start(): Result<ServiceTask, ServiceDomainError> {
    if (this._status !== ServiceTaskStatus.ASSIGNED) {
      return err(
        new ServiceDomainError(
          `Cannot start: current status is ${this._status} (expected ASSIGNED)`,
        ),
      );
    }
    return ok(
      new ServiceTask(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        this._type,
        ServiceTaskStatus.IN_PROGRESS,
        this._assignedTo,
        this._notes,
        this.createdAt,
        this._assignedAt,
        new Date(),
        this._completedAt,
        new Date(),
      ),
    );
  }

  complete(): Result<ServiceTask, ServiceDomainError> {
    if (this._status !== ServiceTaskStatus.IN_PROGRESS) {
      return err(
        new ServiceDomainError(
          `Cannot complete: current status is ${this._status} (expected IN_PROGRESS)`,
        ),
      );
    }
    return ok(
      new ServiceTask(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        this._type,
        ServiceTaskStatus.COMPLETED,
        this._assignedTo,
        this._notes,
        this.createdAt,
        this._assignedAt,
        this._startedAt,
        new Date(),
        new Date(),
      ),
    );
  }

  cancel(): Result<ServiceTask, ServiceDomainError> {
    if (this._status === ServiceTaskStatus.COMPLETED || this._status === ServiceTaskStatus.CANCELLED) {
      return err(
        new ServiceDomainError(
          `Cannot cancel: current status is ${this._status}`,
        ),
      );
    }
    return ok(
      new ServiceTask(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        this._type,
        ServiceTaskStatus.CANCELLED,
        this._assignedTo,
        this._notes,
        this.createdAt,
        this._assignedAt,
        this._startedAt,
        this._completedAt,
        new Date(),
      ),
    );
  }

  updateNotes(notes: string): Result<ServiceTask, ServiceDomainError> {
    if (this._status === ServiceTaskStatus.COMPLETED || this._status === ServiceTaskStatus.CANCELLED) {
      return err(new ServiceDomainError('Cannot update notes: task is finished'));
    }
    return ok(
      new ServiceTask(
        this.id,
        this.restaurantId,
        this.tableSessionId,
        this._type,
        this._status,
        this._assignedTo,
        notes,
        this.createdAt,
        this._assignedAt,
        this._startedAt,
        this._completedAt,
        new Date(),
      ),
    );
  }

  get responseTimeMs(): number | null {
    if (!this._assignedAt) return null;
    return this._assignedAt.getTime() - this.createdAt.getTime();
  }

  get completionTimeMs(): number | null {
    if (!this._completedAt || !this._startedAt) return null;
    return this._completedAt.getTime() - this._startedAt.getTime();
  }

  get totalServiceTimeMs(): number | null {
    const end = this._completedAt ?? new Date();
    return end.getTime() - this.createdAt.getTime();
  }
}

export class ServiceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceDomainError';
  }
}
