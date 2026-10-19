import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth-guard';
import { listConversations, listMessages, markRead, sendMessage } from './service';

const messageSchema = z
  .object({
    body: z.string().trim().max(2000).optional(),
    fileId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.body) || Boolean(value.fileId), {
    message: 'Escribe un mensaje o adjunta una imagen',
    path: ['body'],
  });

const listQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.get('/conversations', async (request) => {
    const userId = await requireUserId(request);
    return { conversations: await listConversations(userId) };
  });

  app.get<{
    Params: { id: string };
    Querystring: { before?: string; limit?: string };
  }>('/conversations/:id/messages', async (request) => {
    const userId = await requireUserId(request);
    const query = listQuerySchema.parse(request.query);
    return {
      messages: await listMessages(userId, request.params.id, query.before, query.limit),
    };
  });

  app.post<{ Params: { id: string } }>(
    '/conversations/:id/messages',
    { config: { rateLimit: { max: 120, timeWindow: '1 hour' } } },
    async (request, reply) => {
    const userId = await requireUserId(request);
    const body = messageSchema.parse(request.body);
    return reply.status(201).send({
      message: await sendMessage(userId, request.params.id, body),
    });
  });

  app.post<{ Params: { id: string } }>('/conversations/:id/read', async (request) => {
    const userId = await requireUserId(request);
    return markRead(userId, request.params.id);
  });
};
