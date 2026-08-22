import { useCallback } from 'react';
import { useAppContext } from './useContextState';

export function useApi() {
  const { restaurantId, actorType, actorId, authToken } = useAppContext();

  const request = useCallback(
    async <T = any>(
      url: string,
      options: RequestInit = {},
    ): Promise<{ data: T | null; error: string | null; status: number }> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-actor-type': actorType,
        'x-actor-id': actorId,
        'x-restaurant-id': restaurantId,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...((options.headers as Record<string, string>) || {}),
      };

      try {
        const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : '';
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

        const response = await fetch(fullUrl, {
          ...options,
          headers,
        });

        const status = response.status;
        let data = null;

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        }

        if (!response.ok) {
          const errorMsg = data?.error || data?.message || `Request failed with status ${status}`;
          return { data: null, error: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg), status };
        }

        return { data, error: null, status };
      } catch (err: any) {
        return { data: null, error: err.message || 'Network error', status: 0 };
      }
    },
    [restaurantId, actorType, actorId, authToken],
  );

  return { request };
}
