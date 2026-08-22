import { FastifyInstance } from 'fastify';
import { loadConfig } from '@restaurant-os/config';
import { VersionResponseSchema } from '@restaurant-os/contracts';

export async function versionRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const config = loadConfig();
    return VersionResponseSchema.parse({
      version: config.apiVersion,
      apiVersion: config.apiVersion,
    });
  });
}
