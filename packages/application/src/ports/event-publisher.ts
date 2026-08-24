import type { DomainEvent, EventType } from '@restaurant-os/domain';

// Event publisher port — implemented by Infrastructure
export interface EventPublisher {
  /**
   * Canonical typed method: Publishes a strongly-typed DomainEvent.
   */
  publish<T = Record<string, unknown>>(event: DomainEvent<T>): Promise<void>;

  /**
   * Transitional overload for use cases during progressive migration.
   */
  publish(eventType: EventType | string, payload: Record<string, unknown>): Promise<void>;
}
