import type { FastifyPluginAsync } from 'fastify';
import {
  branchCreateSchema,
  branchHoursUpdateSchema,
  branchOpenSchema,
  branchUpdateSchema,
  businessCreateSchema,
  businessUpdateSchema,
} from '@buyersclub/core';
import { requireUserId } from '../../lib/auth-guard';
import {
  createBranch,
  createBusiness,
  listBranches,
  listMyBusinesses,
  setBranchHours,
  setBranchManualOpen,
  updateBranch,
  updateBusiness,
} from './service';

export const businessRoutes: FastifyPluginAsync = async (app) => {
  app.post('/businesses', async (request, reply) => {
    const userId = await requireUserId(request);
    const body = businessCreateSchema.parse(request.body);
    return reply.status(201).send({ business: await createBusiness(userId, body) });
  });

  app.get('/businesses/me', async (request) => {
    const userId = await requireUserId(request);
    return { businesses: await listMyBusinesses(userId) };
  });

  app.patch<{ Params: { id: string } }>('/businesses/:id', async (request) => {
    const userId = await requireUserId(request);
    const body = businessUpdateSchema.parse(request.body);
    return { business: await updateBusiness(userId, request.params.id, body) };
  });

  app.post<{ Params: { id: string } }>('/businesses/:id/branches', async (request, reply) => {
    const userId = await requireUserId(request);
    const body = branchCreateSchema.parse(request.body);
    return reply
      .status(201)
      .send({ branch: await createBranch(userId, request.params.id, body) });
  });

  app.get<{ Params: { id: string } }>('/businesses/:id/branches', async (request) => {
    const userId = await requireUserId(request);
    return { branches: await listBranches(userId, request.params.id) };
  });

  app.patch<{ Params: { id: string } }>('/branches/:id', async (request) => {
    const userId = await requireUserId(request);
    const body = branchUpdateSchema.parse(request.body);
    return { branch: await updateBranch(userId, request.params.id, body) };
  });

  app.put<{ Params: { id: string } }>('/branches/:id/hours', async (request) => {
    const userId = await requireUserId(request);
    const body = branchHoursUpdateSchema.parse(request.body);
    return { branches: await setBranchHours(userId, request.params.id, body) };
  });

  app.post<{ Params: { id: string } }>('/branches/:id/open', async (request) => {
    const userId = await requireUserId(request);
    const body = branchOpenSchema.parse(request.body);
    return {
      branch: await setBranchManualOpen(userId, request.params.id, body.manualOpen),
    };
  });
};
