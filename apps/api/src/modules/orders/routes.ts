import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  ORDER_STATUSES,
  orderCancelSchema,
  orderCreateSchema,
  orderStatusUpdateSchema,
} from '@buyersclub/core';
import { requireUserId } from '../../lib/auth-guard';
import {
  cancelOrder,
  createOrder,
  getOrderDetail,
  listBusinessOrders,
  listBuyerOrders,
  updateOrderStatus,
} from './service';

const statusQuerySchema = z.enum(ORDER_STATUSES).optional();

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.post('/orders', async (request, reply) => {
    const userId = await requireUserId(request);
    const body = orderCreateSchema.parse(request.body);
    return reply.status(201).send({ order: await createOrder(userId, body) });
  });

  app.get('/orders', async (request) => {
    const userId = await requireUserId(request);
    return { orders: await listBuyerOrders(userId) };
  });

  app.get<{ Params: { id: string } }>('/orders/:id', async (request) => {
    const userId = await requireUserId(request);
    return { order: await getOrderDetail(userId, request.params.id) };
  });

  app.post<{ Params: { id: string } }>('/orders/:id/cancel', async (request) => {
    const userId = await requireUserId(request);
    const body = orderCancelSchema.parse(request.body);
    return {
      order: await cancelOrder(userId, request.params.id, body.reason),
    };
  });

  app.post<{ Params: { id: string } }>('/orders/:id/status', async (request) => {
    const userId = await requireUserId(request);
    const body = orderStatusUpdateSchema.parse(request.body);
    return {
      order: await updateOrderStatus(userId, request.params.id, body.status, body.note),
    };
  });

  app.get<{ Params: { id: string }; Querystring: { status?: string } }>(
    '/businesses/:id/orders',
    async (request) => {
      const userId = await requireUserId(request);
      const status = statusQuerySchema.parse(request.query.status);
      return {
        orders: await listBusinessOrders(userId, request.params.id, status),
      };
    },
  );
};
