// Event publisher port — implemented by Infrastructure
export interface EventPublisher {
  publish(eventType: string, payload: Record<string, unknown>): Promise<void>;
}
