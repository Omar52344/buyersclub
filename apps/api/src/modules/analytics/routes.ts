import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth-guard';
import { buyerAnalytics, parseRange, vendorAnalytics } from './service';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa YYYY-MM-DD');
const granularitySchema = z.enum(['day', 'week', 'month']).default('day');

const commonQuery = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  granularity: granularitySchema,
});

const vendorQuery = commonQuery.extend({
  businessId: z.string().uuid(),
});

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/analytics/vendor', async (request) => {
    const userId = await requireUserId(request);
    const query = vendorQuery.parse(request.query);
    const range = parseRange(query);
    return vendorAnalytics(userId, query.businessId, range);
  });

  app.get('/analytics/buyer', async (request) => {
    const userId = await requireUserId(request);
    const query = commonQuery.parse(request.query);
    return buyerAnalytics(userId, parseRange(query));
  });
};
