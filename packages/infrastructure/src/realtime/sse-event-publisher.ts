import type { EventPublisher } from '@restaurant-os/application';
import { EventBroadcaster } from './event-broadcaster';

export class SseEventPublisher implements EventPublisher {
  constructor(private readonly broadcaster: EventBroadcaster) {}

  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.broadcaster.broadcast(eventType, payload);
  }
}
