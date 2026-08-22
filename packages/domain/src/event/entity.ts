import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type EventLogId = string;

export enum EventType {
  CUSTOMER_JOINED_WAITLIST = 'CUSTOMER_JOINED_WAITLIST',
  CUSTOMER_CALLED = 'CUSTOMER_CALLED',
  CUSTOMER_CONFIRMED = 'CUSTOMER_CONFIRMED',
  CUSTOMER_CANCELLED_WAIT = 'CUSTOMER_CANCELLED_WAIT',
  CUSTOMER_SELECTED_TAKEAWAY = 'CUSTOMER_SELECTED_TAKEAWAY',
  TABLE_ASSIGNED = 'TABLE_ASSIGNED',
  CUSTOMER_SEATED = 'CUSTOMER_SEATED',
  WAITER_ASSIGNED = 'WAITER_ASSIGNED',
  WAITER_CHANGED = 'WAITER_CHANGED',
  PREORDER_CREATED = 'PREORDER_CREATED',
  PREORDER_UPDATED = 'PREORDER_UPDATED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_SENT_TO_KITCHEN = 'ORDER_SENT_TO_KITCHEN',
  KITCHEN_RECEIVED = 'KITCHEN_RECEIVED',
  KITCHEN_STARTED = 'KITCHEN_STARTED',
  ORDER_NEARLY_READY = 'ORDER_NEARLY_READY',
  ORDER_READY = 'ORDER_READY',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ADDITIONAL_ORDER_CREATED = 'ADDITIONAL_ORDER_CREATED',
  CUSTOMER_ADDED_TO_TABLE = 'CUSTOMER_ADDED_TO_TABLE',
  CUSTOMER_REMOVED_FROM_TABLE = 'CUSTOMER_REMOVED_FROM_TABLE',
  TABLE_CHANGED = 'TABLE_CHANGED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  SERVICE_TASK_CREATED = 'SERVICE_TASK_CREATED',
  KITCHEN_ORDER_ASSIGNED = 'KITCHEN_ORDER_ASSIGNED',
  ACCOUNT_REQUESTED = 'ACCOUNT_REQUESTED',
  PAYMENT_REGISTERED = 'PAYMENT_REGISTERED',
  TABLE_CLOSED = 'TABLE_CLOSED',
  TABLE_RELEASED = 'TABLE_RELEASED',
  TABLE_DEVICE_REGISTERED = 'TABLE_DEVICE_REGISTERED',
  TABLE_DEVICE_ASSOCIATED = 'TABLE_DEVICE_ASSOCIATED',
  TABLE_DEVICE_DISASSOCIATED = 'TABLE_DEVICE_DISASSOCIATED',
  REVIEW_CREATED = 'REVIEW_CREATED',
}

export class EventLog extends Entity<EventLogId> {
  private constructor(
    id: EventLogId,
    public readonly eventType: EventType,
    public readonly restaurantId: string,
    public readonly aggregateType: string,
    public readonly aggregateId: string,
    public readonly tableSessionId: string | null,
    public readonly timestamp: Date,
    public readonly actorType: string | null,
    public readonly actorId: string | null,
    public readonly payload: Record<string, unknown>,
    public readonly createdAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: EventLogId;
    eventType: EventType | string;
    restaurantId: string;
    aggregateType: string;
    aggregateId: string;
    tableSessionId?: string | null;
    actorType?: string | null;
    actorId?: string | null;
    payload?: Record<string, unknown>;
    timestamp?: Date;
    createdAt?: Date;
  }): Result<EventLog, EventLogDomainError> {
    if (!props.eventType || props.eventType.trim().length === 0) {
      return err(new EventLogDomainError('eventType is required'));
    }
    if (!props.restaurantId || props.restaurantId.trim().length === 0) {
      return err(new EventLogDomainError('restaurantId is required'));
    }
    if (!props.aggregateType || props.aggregateType.trim().length === 0) {
      return err(new EventLogDomainError('aggregateType is required'));
    }
    if (!props.aggregateId || props.aggregateId.trim().length === 0) {
      return err(new EventLogDomainError('aggregateId is required'));
    }

    const now = props.timestamp ?? new Date();
    const createdAt = props.createdAt ?? now;

    return ok(
      new EventLog(
        props.id,
        props.eventType as EventType,
        props.restaurantId,
        props.aggregateType,
        props.aggregateId,
        props.tableSessionId ?? null,
        now,
        props.actorType ?? null,
        props.actorId ?? null,
        props.payload ?? {},
        createdAt,
      ),
    );
  }
}

export class EventLogDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventLogDomainError';
  }
}
