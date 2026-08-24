import type { EventPublisher } from '@restaurant-os/application';
import type { DomainEvent, EventType } from '@restaurant-os/domain';
import { EventBroadcaster } from './event-broadcaster';

export class SseEventPublisher implements EventPublisher {
  constructor(private readonly broadcaster: EventBroadcaster) {}

  async publish<T = Record<string, unknown>>(
    eventOrType: DomainEvent<T> | EventType | string,
    legacyPayload?: Record<string, unknown>,
  ): Promise<void> {
    if (typeof eventOrType === 'object' && eventOrType !== null && 'type' in eventOrType) {
      const payload: Record<string, unknown> = {
        ...(eventOrType.payload as Record<string, unknown>),
        tableId: eventOrType.tableId,
        tableNumber: eventOrType.tableNumber,
        tableSessionId: eventOrType.tableSessionId,
        restaurantId: eventOrType.restaurantId,
        actorType: eventOrType.actorType,
      };
      this.broadcaster.broadcast(eventOrType.type, payload);
    } else {
      this.broadcaster.broadcast(eventOrType as string, legacyPayload ?? {});
    }
  }
}
