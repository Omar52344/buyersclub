import type { FastifyPluginAsync } from 'fastify';
import { CURRENCIES, DEFAULT_CURRENCY } from '@buyersclub/core';

export const metaRoutes: FastifyPluginAsync = async (app) => {
  app.get('/meta', async () => ({
    name: 'ClubSellBuy API',
    version: '0.1.0',
    currencies: CURRENCIES,
    defaultCurrency: DEFAULT_CURRENCY,
  }));
};
