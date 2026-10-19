import type { FastifyPluginAsync } from 'fastify';
import { guestOrderCreateSchema } from '@buyersclub/core';
import { createGuestOrder, getGuestBranch } from './service';

export const publicRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { token: string } }>(
    '/public/qr/:token',
    async (request) => getGuestBranch(request.params.token),
  );

  app.post<{ Params: { token: string } }>(
    '/public/qr/:token/orders',
    {
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const body = guestOrderCreateSchema.parse(request.body);
      const order = await createGuestOrder(request.params.token, body);
      return reply.status(201).send(order);
    },
  );
};
