import { useEffect, useRef, useState, useCallback } from 'react';
import type { Workspace } from '../types/workspace';
import { WORKSPACE_CONFIGS } from '../types/workspace';
import type { EventType } from '@restaurant-os/contracts';

export interface SseMessage {
  type?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export interface UseSseOptions {
  token?: string | null;
  eventTypes?: Array<EventType | string>;
  onEvent?: (event: { type: string; payload: Record<string, unknown> }) => void;
  onReconnect?: () => void;
  restaurantId?: string;
  tableSessionId?: string;
  reconnectIntervalMs?: number;
  autoReconnect?: boolean;
}

export function useSse(
  workspaceOrOptions?: Workspace | UseSseOptions,
  restaurantId?: string,
  tableSessionId?: string,
  authToken?: string | null,
) {
  const [messages, setMessages] = useState<SseMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const hasConnectedOnceRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // Normalize options
  let resolvedWorkspace: Workspace | undefined;
  let resolvedToken: string | null | undefined = authToken;
  let resolvedRestaurantId = restaurantId;
  let resolvedTableSessionId = tableSessionId;
  let customEventTypes: Array<EventType | string> | undefined;
  let onEventCallback: ((event: { type: string; payload: Record<string, unknown> }) => void) | undefined;
  let onReconnectCallback: (() => void) | undefined;
  let reconnectIntervalMs = 3000;
  let autoReconnect = true;

  if (typeof workspaceOrOptions === 'object' && workspaceOrOptions !== null) {
    resolvedToken = workspaceOrOptions.token;
    resolvedRestaurantId = workspaceOrOptions.restaurantId;
    resolvedTableSessionId = workspaceOrOptions.tableSessionId;
    customEventTypes = workspaceOrOptions.eventTypes;
    onEventCallback = workspaceOrOptions.onEvent;
    onReconnectCallback = workspaceOrOptions.onReconnect;
    if (workspaceOrOptions.reconnectIntervalMs !== undefined) {
      reconnectIntervalMs = workspaceOrOptions.reconnectIntervalMs;
    }
    if (workspaceOrOptions.autoReconnect !== undefined) {
      autoReconnect = workspaceOrOptions.autoReconnect;
    }
  } else if (typeof workspaceOrOptions === 'string') {
    resolvedWorkspace = workspaceOrOptions as Workspace;
  }

  const config = resolvedWorkspace ? WORKSPACE_CONFIGS[resolvedWorkspace] : null;

  // Keep latest callbacks in refs to avoid reconnection loops on callback identity changes
  const onEventRef = useRef(onEventCallback);
  onEventRef.current = onEventCallback;

  const onReconnectRef = useRef(onReconnectCallback);
  onReconnectRef.current = onReconnectCallback;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (typeof EventSource === 'undefined') return;
    if (eventSourceRef.current) return;

    clearReconnectTimer();

    const params = new URLSearchParams();
    if (resolvedToken) params.set('token', resolvedToken);
    if (resolvedRestaurantId) params.set('restaurantId', resolvedRestaurantId);
    if (resolvedTableSessionId) params.set('tableSessionId', resolvedTableSessionId);

    if (customEventTypes && customEventTypes.length > 0) {
      params.set('eventTypes', customEventTypes.join(','));
    } else if (config?.allowedEventTypes?.length && !config.allowedEventTypes.includes('*')) {
      params.set('eventTypes', config.allowedEventTypes.join(','));
    }

    const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
      ? import.meta.env.VITE_API_URL
      : '';
    const url = `${baseUrl}/api/events/stream?${params.toString()}`;

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (isUnmountedRef.current) {
          es.close();
          return;
        }

        setConnected(true);

        if (hasConnectedOnceRef.current) {
          // Reconnection: invoke snapshot callback
          if (onReconnectRef.current) {
            onReconnectRef.current();
          }
        } else {
          // Initial connection: mark connected but do NOT trigger onReconnect
          hasConnectedOnceRef.current = true;
        }
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.eventType || data.type;
          if (type === 'CONNECTED') return;

          setMessages((prev) => [...prev, data]);
          if (onEventRef.current) {
            onEventRef.current({ type, payload: data.payload || data });
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Schedule reconnection if autoReconnect is true
        if (autoReconnect && !isUnmountedRef.current) {
          clearReconnectTimer();
          reconnectTimerRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connect();
            }
          }, reconnectIntervalMs);
        }
      };
    } catch {
      setConnected(false);
    }
  }, [
    resolvedToken,
    resolvedRestaurantId,
    resolvedTableSessionId,
    customEventTypes,
    config,
    clearReconnectTimer,
    autoReconnect,
    reconnectIntervalMs,
  ]);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, [clearReconnectTimer]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [connect, disconnect]);

  return { messages, connected, connect, disconnect };
}
