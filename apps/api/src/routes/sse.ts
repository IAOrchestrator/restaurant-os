import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { EventBroadcaster, JwtService } from '@restaurant-os/infrastructure';

export interface SseRoutesOptions {
  broadcaster: EventBroadcaster;
  jwtService?: JwtService;
}

export async function sseRoutes(app: FastifyInstance, opts: SseRoutesOptions) {
  const jwt = opts.jwtService || new JwtService();

  // GET /api/events/stream — Server-Sent Events endpoint (Secure handshake)
  app.get('/stream', async (request, reply) => {
    const query = request.query as {
      restaurantId?: string;
      eventTypes?: string;
      tableSessionId?: string;
      token?: string;
    };

    let effectiveRestaurantId = query.restaurantId ?? null;
    let effectiveTableSessionId = query.tableSessionId ?? null;
    let actorType: string = 'ANONYMOUS';
    let actorId: string | null = null;
    let waiterId: string | null = null;

    // 1. Extract Token from Authorization header or query parameter
    const authHeader = request.headers['authorization'];
    const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const token = tokenFromHeader || query.token;

    if (token) {
      const verified = jwt.verify(token);
      if (!verified.success) {
        return reply.status(401).send({ error: 'Unauthorized: Invalid SSE token', details: verified.error.message });
      }

      const payload = verified.value;
      actorType = payload.type;
      actorId = payload.sub;

      if (payload.restaurantId) {
        effectiveRestaurantId = payload.restaurantId;
      }

      if (payload.type === 'CUSTOMER') {
        // Enforce session boundary for customers: cannot subscribe to arbitrary sessions
        effectiveTableSessionId = (payload as any).tableSessionId || query.tableSessionId || null;
      } else if (payload.type === 'STAFF') {
        const roles = (payload as any).roles || [];
        if (roles.includes('WAITER')) {
          waiterId = payload.sub;
        }
      }
    }

    const reqOrigin = (request.headers.origin as string) || '*';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': reqOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    });

    const connId = randomUUID();
    const parsedEventTypes = query.eventTypes ? query.eventTypes.split(',') : null;

    // Send initial connection event with verified identity metadata
    reply.raw.write(
      `data: ${JSON.stringify({
        eventType: 'CONNECTED',
        payload: {
          connectionId: connId,
          actorType,
          actorId,
          restaurantId: effectiveRestaurantId,
          tableSessionId: effectiveTableSessionId,
        },
        timestamp: new Date().toISOString(),
      })}\n\n`,
    );

    const connection = {
      id: connId,
      restaurantId: effectiveRestaurantId,
      tableSessionId: effectiveTableSessionId,
      actorType,
      actorId,
      waiterId,
      eventTypes: parsedEventTypes,
      write: (data: string) => {
        try {
          reply.raw.write(data);
        } catch {
          opts.broadcaster.removeConnection(connId);
        }
      },
      close: () => {
        reply.raw.end();
      },
    };

    opts.broadcaster.addConnection(connection);

    // Handle client disconnect
    request.raw.on('close', () => {
      opts.broadcaster.removeConnection(connId);
    });

    // Keep connection alive with heartbeat every 20s
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(':heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        opts.broadcaster.removeConnection(connId);
      }
    }, 20000);

    // Clean up on close
    request.raw.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  // GET /api/events/stream/stats — Connection stats (admin/debug)
  app.get('/stream/stats', async (_request, _reply) => {
    const connections = opts.broadcaster.getConnections();
    return {
      totalConnections: connections.length,
      connections: connections.map((c) => ({
        id: c.id,
        restaurantId: c.restaurantId,
        actorType: c.actorType,
        tableSessionId: c.tableSessionId,
        eventTypes: c.eventTypes,
      })),
    };
  });
}
