import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { EventBroadcaster, JwtService } from '@restaurant-os/infrastructure';
import { sseRoutes } from '../src/routes/sse';

describe('SSE Authentication & Multi-Tenant / Session Isolation', () => {
  let app: FastifyInstance;
  const broadcaster = new EventBroadcaster();
  const jwtService = new JwtService('test_sse_jwt_secret_123');

  const RESTAURANT_1 = 'a0000000-0000-0000-0000-000000000001';
  const RESTAURANT_2 = 'a0000000-0000-0000-0000-000000000002';
  const SESSION_1 = 'c0000000-0000-0000-0000-000000000001';
  const SESSION_2 = 'c0000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    app = fastify();
    await app.register(sseRoutes, { prefix: '/api/events', broadcaster, jwtService });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects SSE connection when token is invalid or tampered', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/events/stream?token=invalid.tampered.token',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('Unauthorized');
  });

  it('returns stream stats via /api/events/stream/stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/events/stream/stats',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.totalConnections).toBeDefined();
  });

  it('verifies EventBroadcaster enforces cross-restaurant and cross-session isolation', () => {
    const messagesR1S1: string[] = [];
    const messagesR1S2: string[] = [];
    const messagesR2: string[] = [];

    // Client 1: Customer in Restaurant 1, Session 1
    broadcaster.addConnection({
      id: 'conn-r1-s1',
      restaurantId: RESTAURANT_1,
      tableSessionId: SESSION_1,
      actorType: 'CUSTOMER',
      eventTypes: null,
      write: (data: string) => messagesR1S1.push(data),
      close: () => {},
    });

    // Client 2: Customer in Restaurant 1, Session 2
    broadcaster.addConnection({
      id: 'conn-r1-s2',
      restaurantId: RESTAURANT_1,
      tableSessionId: SESSION_2,
      actorType: 'CUSTOMER',
      eventTypes: null,
      write: (data: string) => messagesR1S2.push(data),
      close: () => {},
    });

    // Client 3: Staff in Restaurant 2
    broadcaster.addConnection({
      id: 'conn-r2',
      restaurantId: RESTAURANT_2,
      tableSessionId: null,
      actorType: 'STAFF',
      eventTypes: null,
      write: (data: string) => messagesR2.push(data),
      close: () => {},
    });

    // 1. Broadcast an event for Restaurant 1, Session 1
    broadcaster.broadcast('ORDER_CREATED', {
      restaurantId: RESTAURANT_1,
      tableSessionId: SESSION_1,
      orderId: 'order-101',
    });

    // Only Client 1 should receive it
    expect(messagesR1S1).toHaveLength(1);
    expect(messagesR1S1[0]).toContain('ORDER_CREATED');
    expect(messagesR1S2).toHaveLength(0); // Isolated
    expect(messagesR2).toHaveLength(0);   // Isolated

    // 2. Broadcast an event for Restaurant 2
    broadcaster.broadcast('TABLE_SESSION_OPENED', {
      restaurantId: RESTAURANT_2,
      tableSessionId: 'session-999',
    });

    // Only Client 3 should receive it
    expect(messagesR1S1).toHaveLength(1); // Unchanged
    expect(messagesR1S2).toHaveLength(0); // Unchanged
    expect(messagesR2).toHaveLength(1);
    expect(messagesR2[0]).toContain('TABLE_SESSION_OPENED');

    // Cleanup
    broadcaster.removeConnection('conn-r1-s1');
    broadcaster.removeConnection('conn-r1-s2');
    broadcaster.removeConnection('conn-r2');
  });
});
