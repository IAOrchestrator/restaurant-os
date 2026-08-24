import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSse } from './useSse';

// Mock EventSource implementation
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  // Helper test methods
  triggerOpen() {
    if (this.onopen && !this.closed) {
      this.onopen();
    }
  }

  triggerMessage(data: Record<string, unknown> | string) {
    if (this.onmessage && !this.closed) {
      this.onmessage({
        data: typeof data === 'string' ? data : JSON.stringify(data),
      });
    }
  }

  triggerError() {
    if (this.onerror && !this.closed) {
      this.onerror();
    }
  }
}

describe('useSse Hook — Reconnection & Snapshot Protocol (Step 2.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).EventSource;
  });

  it('1. Initial Connection: creates EventSource and sets connected to true on open', () => {
    const onReconnect = vi.fn();
    const { result } = renderHook(() =>
      useSse({
        token: 'test-token',
        restaurantId: 'rest-1',
        onReconnect,
      }),
    );

    expect(MockEventSource.instances.length).toBe(1);
    const es = MockEventSource.instances[0];
    expect(result.current.connected).toBe(false);

    act(() => {
      es.triggerOpen();
    });

    expect(result.current.connected).toBe(true);
    // MUST NOT trigger onReconnect on initial connect!
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('2. Disconnection / Error: sets connected to false and closes previous EventSource', () => {
    const { result } = renderHook(() =>
      useSse({
        token: 'test-token',
        restaurantId: 'rest-1',
        reconnectIntervalMs: 1000,
      }),
    );

    const es1 = MockEventSource.instances[0];
    act(() => {
      es1.triggerOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      es1.triggerError();
    });

    expect(result.current.connected).toBe(false);
    expect(es1.closed).toBe(true);
  });

  it('3. Reconnection: triggers onReconnect snapshot callback on successful reconnect', () => {
    const onReconnect = vi.fn();
    const { result } = renderHook(() =>
      useSse({
        token: 'test-token',
        restaurantId: 'rest-1',
        onReconnect,
        reconnectIntervalMs: 1000,
      }),
    );

    const es1 = MockEventSource.instances[0];
    // Initial connect
    act(() => {
      es1.triggerOpen();
    });
    expect(onReconnect).toHaveBeenCalledTimes(0);

    // Disconnect
    act(() => {
      es1.triggerError();
    });
    expect(result.current.connected).toBe(false);

    // Advance timer to trigger automatic reconnect
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockEventSource.instances.length).toBe(2);
    const es2 = MockEventSource.instances[1];

    // Reconnect opens successfully
    act(() => {
      es2.triggerOpen();
    });

    expect(result.current.connected).toBe(true);
    // onReconnect MUST be called exactly once for this reconnection
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('4. Multiple Reconnections: invokes onReconnect once per successful reconnect', () => {
    const onReconnect = vi.fn();
    renderHook(() =>
      useSse({
        token: 'test-token',
        restaurantId: 'rest-1',
        onReconnect,
        reconnectIntervalMs: 500,
      }),
    );

    const es1 = MockEventSource.instances[0];
    // Initial
    act(() => {
      es1.triggerOpen();
    });
    expect(onReconnect).toHaveBeenCalledTimes(0);

    // Disconnect 1
    act(() => {
      es1.triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const es2 = MockEventSource.instances[1];
    act(() => {
      es2.triggerOpen();
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // Disconnect 2
    act(() => {
      es2.triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const es3 = MockEventSource.instances[2];
    act(() => {
      es3.triggerOpen();
    });
    expect(onReconnect).toHaveBeenCalledTimes(2);
  });

  it('5. Avoids duplicate callbacks when onReconnect reference changes', () => {
    let reconnectCount = 0;
    const { rerender } = renderHook(
      ({ callback }) =>
        useSse({
          token: 'test-token',
          restaurantId: 'rest-1',
          onReconnect: callback,
          reconnectIntervalMs: 500,
        }),
      {
        initialProps: {
          callback: () => {
            reconnectCount++;
          },
        },
      },
    );

    const es1 = MockEventSource.instances[0];
    act(() => {
      es1.triggerOpen();
    });

    // Re-render with a new callback reference while connected
    rerender({
      callback: () => {
        reconnectCount += 10;
      },
    });

    // No new EventSource created just because callback reference changed
    expect(MockEventSource.instances.length).toBe(1);
    expect(reconnectCount).toBe(0);

    // Disconnect and reconnect
    act(() => {
      es1.triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const es2 = MockEventSource.instances[1];
    act(() => {
      es2.triggerOpen();
    });

    // The latest callback reference is called
    expect(reconnectCount).toBe(10);
  });

  it('6. Cleanup on Unmount: closes EventSource and cancels pending reconnect timers', () => {
    const onReconnect = vi.fn();
    const { unmount } = renderHook(() =>
      useSse({
        token: 'test-token',
        restaurantId: 'rest-1',
        onReconnect,
        reconnectIntervalMs: 1000,
      }),
    );

    const es1 = MockEventSource.instances[0];
    act(() => {
      es1.triggerOpen();
    });

    act(() => {
      es1.triggerError();
    });

    // Unmount before reconnect timer fires
    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // No new EventSource created after unmount
    expect(MockEventSource.instances.length).toBe(1);
    expect(es1.closed).toBe(true);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('7. Real-time message dispatching via onEvent', () => {
    const onEvent = vi.fn();
    renderHook(() =>
      useSse({
        token: 'test-token',
        restaurantId: 'rest-1',
        onEvent,
      }),
    );

    const es = MockEventSource.instances[0];
    act(() => {
      es.triggerOpen();
      es.triggerMessage({
        type: 'ORDER_READY',
        payload: { orderId: 'ord-123', tableNumber: 4 },
      });
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'ORDER_READY',
      payload: { orderId: 'ord-123', tableNumber: 4 },
    });
  });
});
