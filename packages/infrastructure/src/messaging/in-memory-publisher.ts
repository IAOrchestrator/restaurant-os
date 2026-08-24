// In-memory event publisher for testing and initial development
import type { EventPublisher } from '@restaurant-os/application';
import type { DomainEvent, EventType } from '@restaurant-os/domain';

export class InMemoryEventPublisher implements EventPublisher {
  private events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

  async publish<T = Record<string, unknown>>(
    eventOrType: DomainEvent<T> | EventType | string,
    legacyPayload?: Record<string, unknown>,
  ): Promise<void> {
    if (typeof eventOrType === 'object' && eventOrType !== null && 'type' in eventOrType) {
      this.events.push({
        eventType: eventOrType.type,
        payload: {
          ...(eventOrType.payload as Record<string, unknown>),
          tableId: eventOrType.tableId,
          tableNumber: eventOrType.tableNumber,
          tableSessionId: eventOrType.tableSessionId,
          restaurantId: eventOrType.restaurantId,
          actorType: eventOrType.actorType,
        },
      });
    } else {
      this.events.push({ eventType: eventOrType as string, payload: legacyPayload ?? {} });
    }
  }

  getEvents() {
    return this.events;
  }

  clear() {
    this.events = [];
  }
}
