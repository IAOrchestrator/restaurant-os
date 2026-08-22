// In-memory event publisher for testing and initial development
import type { EventPublisher } from '@restaurant-os/application';

export class InMemoryEventPublisher implements EventPublisher {
  private events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.events.push({ eventType, payload });
  }

  getEvents() {
    return this.events;
  }

  clear() {
    this.events = [];
  }
}
