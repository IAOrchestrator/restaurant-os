import type { EventPublisher } from '@restaurant-os/application';
import type { EventLogRepository } from '@restaurant-os/application';
import { EventLog } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';

export class PersistingEventPublisher implements EventPublisher {
  constructor(
    private readonly eventLogRepo: EventLogRepository,
    private readonly delegate?: EventPublisher,
  ) {}

  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const restaurantId = (payload.restaurantId as string) || 'system';
    const aggregateId = (payload.aggregateId as string)
      || (payload.accountId as string)
      || (payload.orderId as string)
      || (payload.tableSessionId as string)
      || (payload.id as string)
      || 'system';
    const aggregateType = this.inferAggregateType(eventType, payload);
    const tableSessionId = (payload.tableSessionId as string) || null;
    const actorType = (payload.actorType as string) || null;
    const actorId = (payload.actorId as string) || null;

    const eventResult = EventLog.create({
      id: randomUUID(),
      eventType,
      restaurantId,
      aggregateType,
      aggregateId,
      tableSessionId,
      actorType,
      actorId,
      payload,
      timestamp: new Date(),
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
