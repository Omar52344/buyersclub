import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { paymentEvidenceSchema } from '@buyersclub/core';
import { requireUserId } from '../../lib/auth-guard';
import { rejectPayment, submitPaymentEvidence, validatePayment } from './service';

const rejectSchema = z.object({
  reason: z.string().min(3).max(200),
});

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>('/orders/:id/payment-evidence', async (request) => {
    const userId = await requireUserId(request);
    const body = paymentEvidenceSchema.parse(request.body);
    return { order: await submitPaymentEvidence(userId, request.params.id, body) };
  });

  app.post<{ Params: { id: string } }>('/payments/:id/validate', async (request) => {
    const userId = await requireUserId(request);
    return { order: await validatePayment(userId, request.params.id) };
  });

  app.post<{ Params: { id: string } }>('/payments/:id/reject', async (request) => {
    const userId = await requireUserId(request);
    const body = rejectSchema.parse(request.body);
    return { order: await rejectPayment(userId, request.params.id, body.reason) };
  });
};
