import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { findNearbyBranches, getPublicBranch } from './service';

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(20_000).default(5_000),
  categoryId: z.string().uuid().optional(),
  fulfillment: z.enum(['delivery', 'pickup']).optional(),
  q: z.string().max(80).optional(),
  openNow: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const discoveryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/discovery/branches', async (request) => {
    const query = nearbyQuerySchema.parse(request.query);
    return { items: await findNearbyBranches(query) };
  });

  app.get<{ Params: { id: string } }>('/discovery/branches/:id', async (request) => {
    return { branch: await getPublicBranch(request.params.id) };
  });
};
