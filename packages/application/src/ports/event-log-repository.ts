import type { EventLog, EventLogId } from '@restaurant-os/domain';

export interface EventLogRepository {
  findById(id: EventLogId): Promise<EventLog | null>;
  findByRestaurantId(restaurantId: string, limit?: number): Promise<EventLog[]>;
  findByAggregateId(aggregateId: string): Promise<EventLog[]>;
  findByTableSessionId(tableSessionId: string): Promise<EventLog[]>;
  findByEventType(eventType: string, restaurantId: string, limit?: number): Promise<EventLog[]>;
  save(eventLog: EventLog): Promise<void>;
}
