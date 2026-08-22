import { describe, it, expect } from 'vitest';
import { InMemoryEventPublisher } from '../src/messaging/in-memory-publisher';

describe('Infrastructure layer', () => {
  it('InMemoryEventPublisher can publish and clear', async () => {
    const pub = new InMemoryEventPublisher();
    await pub.publish('EVENT_A', { x: 1 });
    await pub.publish('EVENT_B', { y: 2 });
    expect(pub.getEvents()).toHaveLength(2);
    pub.clear();
    expect(pub.getEvents()).toHaveLength(0);
  });
});
