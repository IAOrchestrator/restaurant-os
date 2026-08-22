import { useEffect, useRef, useState, useCallback } from 'react';
import type { Workspace } from '../types/workspace';
import { WORKSPACE_CONFIGS } from '../types/workspace';

export interface SseMessage {
  type?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export interface UseSseOptions {
  token?: string | null;
  eventTypes?: string[];
  onEvent?: (event: { type: string; payload: Record<string, unknown> }) => void;
  restaurantId?: string;
  tableSessionId?: string;
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

  // Normalize options
  let resolvedWorkspace: Workspace | undefined;
  let resolvedToken: string | null | undefined = authToken;
  let resolvedRestaurantId = restaurantId;
  let resolvedTableSessionId = tableSessionId;
  let customEventTypes: string[] | undefined;
  let onEventCallback: ((event: { type: string; payload: Record<string, unknown> }) => void) | undefined;

  if (typeof workspaceOrOptions === 'object' && workspaceOrOptions !== null) {
    resolvedToken = workspaceOrOptions.token;
    resolvedRestaurantId = workspaceOrOptions.restaurantId;
    resolvedTableSessionId = workspaceOrOptions.tableSessionId;
    customEventTypes = workspaceOrOptions.eventTypes;
    onEventCallback = workspaceOrOptions.onEvent;
  } else if (typeof workspaceOrOptions === 'string') {
    resolvedWorkspace = workspaceOrOptions as Workspace;
  }

  const config = resolvedWorkspace ? WORKSPACE_CONFIGS[resolvedWorkspace] : null;

  const connect = useCallback(() => {
    if (typeof EventSource === 'undefined') return;
    if (eventSourceRef.current) return;

    const params = new URLSearchParams();
    if (resolvedToken) params.set('token', resolvedToken);
    if (resolvedRestaurantId) params.set('restaurantId', resolvedRestaurantId);
    if (resolvedTableSessionId) params.set('tableSessionId', resolvedTableSessionId);

    if (customEventTypes && customEventTypes.length > 0) {
      params.set('eventTypes', customEventTypes.join(','));
    } else if (config?.allowedEventTypes?.length && !config.allowedEventTypes.includes('*')) {
      params.set('eventTypes', config.allowedEventTypes.join(','));
    }

    const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : '';
    const url = `${baseUrl}/api/events/stream?${params.toString()}`;

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.eventType || data.type;
          if (type === 'CONNECTED') return;

          setMessages((prev) => [...prev, data]);
          if (onEventCallback) {
            onEventCallback({ type, payload: data.payload || data });
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
      };
    } catch {
      setConnected(false);
    }
  }, [resolvedWorkspace, resolvedRestaurantId, resolvedTableSessionId, resolvedToken, config, customEventTypes, onEventCallback]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { messages, connected, connect, disconnect };
}
