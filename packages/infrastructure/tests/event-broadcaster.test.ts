import { describe, it, expect, vi } from 'vitest';
import { EventBroadcaster } from '../src/realtime/event-broadcaster';

describe('EventBroadcaster', () => {
  it('should add and remove connections', () => {
    const broadcaster = new EventBroadcaster();
    const conn = {
      id: 'conn-1',
      restaurantId: null,
      eventTypes: null,
      write: vi.fn(),
      close: vi.fn(),
    };

    broadcaster.addConnection(conn);
    expect(broadcaster.getConnectionCount()).toBe(1);

    broadcaster.removeConnection('conn-1');
    expect(broadcaster.getConnectionCount()).toBe(0);
  });

  it('should broadcast to all connections', () => {
    const broadcaster = new EventBroadcaster();
    const write1 = vi.fn();
    const write2 = vi.fn();

    broadcaster.addConnection({
      id: 'conn-1', restaurantId: null, eventTypes: null,
      write: write1, close: vi.fn(),
    });
    broadcaster.addConnection({
      id: 'conn-2', restaurantId: null, eventTypes: null,
      write: write2, close: vi.fn(),
    });

    broadcaster.broadcast('ORDER_READY', { orderId: 'o-1', restaurantId: 'r-1' });

    expect(write1).toHaveBeenCalledTimes(1);
    expect(write2).toHaveBeenCalledTimes(1);
  });

  it('should filter by restaurantId', () => {
    const broadcaster = new EventBroadcaster();
    const write1 = vi.fn();
    const write2 = vi.fn();

    broadcaster.addConnection({
      id: 'conn-1', restaurantId: 'r-1', eventTypes: null,
      write: write1, close: vi.fn(),
    });
    broadcaster.addConnection({
      id: 'conn-2', restaurantId: 'r-2', eventTypes: null,
      write: write2, close: vi.fn(),
    });

    broadcaster.broadcast('ORDER_READY', { orderId: 'o-1', restaurantId: 'r-1' });

    expect(write1).toHaveBeenCalledTimes(1);
    expect(write2).not.toHaveBeenCalled();
  });

  it('should filter by eventType', () => {
    const broadcaster = new EventBroadcaster();
    const write1 = vi.fn();
    const write2 = vi.fn();

    broadcaster.addConnection({
      id: 'conn-1', restaurantId: null, eventTypes: ['ORDER_READY'],
      write: write1, close: vi.fn(),
    });
    broadcaster.addConnection({
      id: 'conn-2', restaurantId: null, eventTypes: ['KITCHEN_STARTED'],
      write: write2, close: vi.fn(),
    });

    broadcaster.broadcast('ORDER_READY', { orderId: 'o-1', restaurantId: 'r-1' });

    expect(write1).toHaveBeenCalledTimes(1);
    expect(write2).not.toHaveBeenCalled();
  });

  it('should support wildcard event types', () => {
    const broadcaster = new EventBroadcaster();
    const write = vi.fn();

    broadcaster.addConnection({
      id: 'conn-1', restaurantId: null, eventTypes: ['*'],
      write, close: vi.fn(),
    });

    broadcaster.broadcast('ANY_EVENT', { data: 'test' });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('should remove broken connections on write error', () => {
    const broadcaster = new EventBroadcaster();
    const write = vi.fn().mockImplementation(() => { throw new Error('broken'); });

    broadcaster.addConnection({
      id: 'conn-1', restaurantId: null, eventTypes: null,
      write, close: vi.fn(),
    });

    broadcaster.broadcast('TEST', {});
    expect(broadcaster.getConnectionCount()).toBe(0);
  });
});
