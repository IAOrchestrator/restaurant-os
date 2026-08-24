import { EventType } from './entity';
import { ActorType } from '../identity/actor';
import { randomUUID } from 'crypto';

export interface DomainEvent<T = Record<string, unknown>> {
  readonly id: string;
  readonly type: EventType;
  readonly restaurantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly tableSessionId?: string | null;
  readonly tableId?: string | null;
  readonly tableNumber?: number | null;
  readonly actorType: ActorType;
  readonly actorId?: string | null;
  readonly timestamp: string; // ISO 8601 UTC
  readonly payload: T;
}

export function createDomainEvent<T = Record<string, unknown>>(props: {
  id?: string;
  type: EventType;
  restaurantId: string;
  aggregateType: string;
  aggregateId: string;
  tableSessionId?: string | null;
  tableId?: string | null;
  tableNumber?: number | null;
  actorType?: ActorType;
  actorId?: string | null;
  timestamp?: string | Date;
  payload: T;
}): DomainEvent<T> {
  const id = props.id ?? randomUUID();

  return {
    id,
    type: props.type,
    restaurantId: props.restaurantId,
    aggregateType: props.aggregateType,
    aggregateId: props.aggregateId,
    tableSessionId: props.tableSessionId ?? null,
    tableId: props.tableId ?? null,
    tableNumber: props.tableNumber ?? null,
    actorType: props.actorType ?? ActorType.SYSTEM,
    actorId: props.actorId ?? null,
    timestamp: typeof props.timestamp === 'string'
      ? props.timestamp
      : (props.timestamp?.toISOString() ?? new Date().toISOString()),
    payload: props.payload,
  };
}
