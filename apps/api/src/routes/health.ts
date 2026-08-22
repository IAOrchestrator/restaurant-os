import { FastifyInstance } from 'fastify';
import { HealthResponseSchema } from '@restaurant-os/contracts';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return HealthResponseSchema.parse({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });
}
