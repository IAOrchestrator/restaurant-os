// EventBroadcaster — manages SSE connections and broadcasts events in real-time
// Enforces cross-restaurant and cross-session isolation

export interface SseConnection {
  id: string;
  restaurantId: string | null;
  tableSessionId: string | null; // null = all table sessions (for staff/admin)
  actorType?: string | null;     // 'STAFF' | 'TABLE_DEVICE' | 'CUSTOMER' | 'SYSTEM'
  actorId?: string | null;
  waiterId?: string | null;      // if staff is a waiter
  eventTypes: string[] | null;   // null = all events
  write: (data: string) => void;
  close: () => void;
}

export class EventBroadcaster {
  private connections = new Map<string, SseConnection>();

  addConnection(conn: SseConnection): void {
    this.connections.set(conn.id, conn);
  }

  removeConnection(id: string): void {
    this.connections.delete(id);
  }

  broadcast(eventType: string, payload: Record<string, unknown>): void {
    const message = JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() });
    const data = `data: ${message}\n\n`;

    for (const conn of this.connections.values()) {
      // 1. Strict multi-tenant isolation
      if (conn.restaurantId && payload.restaurantId && payload.restaurantId !== conn.restaurantId && payload.restaurantId !== 'system') {
        continue;
      }

      // 2. Strict TableSession isolation (for Customers & Table Devices)
      if (conn.tableSessionId && payload.tableSessionId && payload.tableSessionId !== conn.tableSessionId) {
        continue;
      }

      // 3. EventType filter
      if (conn.eventTypes && !conn.eventTypes.includes(eventType) && !conn.eventTypes.includes('*')) {
        continue;
      }

      try {
        conn.write(data);
      } catch {
        this.removeConnection(conn.id);
      }
    }
  }

  broadcastToRestaurant(restaurantId: string, eventType: string, payload: Record<string, unknown>): void {
    this.broadcast(eventType, { ...payload, restaurantId });
  }

  broadcastToTableSession(tableSessionId: string, eventType: string, payload: Record<string, unknown>): void {
    this.broadcast(eventType, { ...payload, tableSessionId });
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnections(): SseConnection[] {
    return Array.from(this.connections.values());
  }
}
