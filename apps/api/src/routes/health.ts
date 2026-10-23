import type { FastifyInstance } from 'fastify';
import { sqlClient } from '../db/index';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'clubsellbuy-api',
    version: '0.1.0',
    uptime: Math.round(process.uptime()),
  }));

  app.get('/health/ready', async (_request, reply) => {
    try {
      await sqlClient`select 1`;
      return { status: 'ready', db: 'up' };
    } catch {
      return reply.status(503).send({ status: 'degraded', db: 'down' });
    }
  });
}
