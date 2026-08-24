import type { EventPublisher, EventLogRepository } from '@restaurant-os/application';
import { EventLog, type DomainEvent, EventType } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';

export class PersistingEventPublisher implements EventPublisher {
  constructor(
    private readonly eventLogRepo: EventLogRepository,
    private readonly delegate?: EventPublisher,
  ) {}

  async publish<T = Record<string, unknown>>(
    eventOrType: DomainEvent<T> | EventType | string,
    legacyPayload?: Record<string, unknown>,
  ): Promise<void> {
    let eventId: string;
    let eventType: string;
    let restaurantId: string;
    let aggregateType: string;
    let aggregateId: string;
    let tableSessionId: string | null = null;
    let actorType: string | null = null;
    let actorId: string | null = null;
    let timestamp: Date;
    let payload: Record<string, unknown>;

    if (typeof eventOrType === 'object' && eventOrType !== null && 'type' in eventOrType && 'payload' in eventOrType) {
      // Canonical DomainEvent<T> branch
      const domainEvent = eventOrType as DomainEvent<T>;
      eventId = domainEvent.id || randomUUID();
      eventType = domainEvent.type;
      restaurantId = domainEvent.restaurantId;
      aggregateType = domainEvent.aggregateType;
      aggregateId = domainEvent.aggregateId;
      tableSessionId = domainEvent.tableSessionId ?? null;
      actorType = domainEvent.actorType ?? null;
      actorId = domainEvent.actorId ?? null;
      timestamp = new Date(domainEvent.timestamp);
      payload = {
        ...(domainEvent.payload as Record<string, unknown>),
        tableId: domainEvent.tableId ?? (domainEvent.payload as any)?.tableId,
        tableNumber: domainEvent.tableNumber ?? (domainEvent.payload as any)?.tableNumber,
        tableSessionId: domainEvent.tableSessionId ?? (domainEvent.payload as any)?.tableSessionId,
        restaurantId: domainEvent.restaurantId,
      };
    } else {
      // Transitional legacy branch
      eventType = eventOrType as string;
      const rawPayload = legacyPayload ?? {};
      eventId = randomUUID();
      restaurantId = (rawPayload.restaurantId as string) || 'system';
      aggregateId = (rawPayload.aggregateId as string)
        || (rawPayload.accountId as string)
        || (rawPayload.orderId as string)
        || (rawPayload.tableSessionId as string)
        || (rawPayload.id as string)
        || 'system';
      aggregateType = this.inferAggregateType(eventType, rawPayload);
      tableSessionId = (rawPayload.tableSessionId as string) || null;
      actorType = (rawPayload.actorType as string) || null;
      actorId = (rawPayload.actorId as string) || null;
      timestamp = new Date();
      payload = rawPayload;
    }

    const eventResult = EventLog.create({
      id: eventId,
      eventType,
      restaurantId,
      aggregateType,
      aggregateId,
      tableSessionId,
      actorType,
      actorId,
      payload,
      timestamp,
    });

    if (eventResult.success) {
      await this.eventLogRepo.save(eventResult.value);
    }

    if (this.delegate) {
      await this.delegate.publish(eventType, payload);
    }
  }

  private inferAggregateType(eventType: string, _payload: Record<string, unknown>): string {
    if (eventType.includes('WAITLIST') || eventType.includes('CUSTOMER_JOINED') || eventType.includes('CUSTOMER_CALLED') || eventType.includes('CUSTOMER_CONFIRMED') || eventType.includes('CUSTOMER_CANCELLED')) return 'WaitlistEntry';
    if (eventType.includes('TABLE') && !eventType.includes('SESSION')) return 'Table';
    if (eventType.includes('SESSION') || eventType.includes('WAITER')) return 'TableSession';
    if (eventType.includes('ORDER') && !eventType.includes('PREORDER')) return 'Order';
    if (eventType.includes('PREORDER')) return 'PreOrder';
    if (eventType.includes('ACCOUNT') || eventType.includes('PAYMENT')) return 'Account';
    if (eventType.includes('REVIEW')) return 'Review';
    if (eventType.includes('NOTIFICATION')) return 'Notification';
    return 'Unknown';
  }
}
