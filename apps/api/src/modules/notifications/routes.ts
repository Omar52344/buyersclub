import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { deviceTokenSchema } from '@buyersclub/core';
import { requireUserId } from '../../lib/auth-guard';
import {
  listNotifications,
  markNotificationsRead,
  registerDevice,
  removeDevice,
} from './service';

const readSchema = z.object({
  ids: z.array(z.string().uuid()).max(100).optional(),
});

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { unread?: string } }>('/notifications', async (request) => {
    const userId = await requireUserId(request);
    return {
      notifications: await listNotifications(
        userId,
        request.query.unread === 'true',
      ),
    };
  });

  app.post('/notifications/read', async (request) => {
    const userId = await requireUserId(request);
    const body = readSchema.parse(request.body ?? {});
    return markNotificationsRead(userId, body.ids);
  });

  app.post('/me/devices', async (request, reply) => {
    const userId = await requireUserId(request);
    const body = deviceTokenSchema.parse(request.body);
    return reply.status(201).send(await registerDevice(userId, body));
  });

  app.delete<{ Params: { token: string } }>('/me/devices/:token', async (request) => {
    const userId = await requireUserId(request);
    return removeDevice(userId, request.params.token);
  });
};
