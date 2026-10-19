import type { FastifyPluginAsync } from 'fastify';
import {
  branchProductsBulkSchema,
  productBranchesUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
} from '@buyersclub/core';
import { AppError } from '../../errors';
import { requireUserId } from '../../lib/auth-guard';
import {
  bulkSetBranchProducts,
  createProduct,
  listBranchProducts,
  listCategories,
  listProducts,
  setProductBranches,
  updateProduct,
} from './service';

export const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get('/categories', async () => ({ categories: await listCategories() }));

  app.post('/products', async (request, reply) => {
    const userId = await requireUserId(request);
    const body = productCreateSchema.parse(request.body);
    return reply.status(201).send({ product: await createProduct(userId, body) });
  });

  app.get<{ Querystring: { businessId?: string } }>('/products', async (request) => {
    const userId = await requireUserId(request);
    const businessId = request.query.businessId;
    if (!businessId) {
      throw new AppError('BAD_REQUEST', 'Falta el parámetro businessId.', 400);
    }
    return { products: await listProducts(userId, businessId) };
  });

  app.patch<{ Params: { id: string } }>('/products/:id', async (request) => {
    const userId = await requireUserId(request);
    const body = productUpdateSchema.parse(request.body);
    return { product: await updateProduct(userId, request.params.id, body) };
  });

  app.delete<{ Params: { id: string } }>('/products/:id', async (request) => {
    const userId = await requireUserId(request);
    return {
      product: await updateProduct(userId, request.params.id, { isActive: false }),
    };
  });

  app.put<{ Params: { id: string } }>('/products/:id/branches', async (request) => {
    const userId = await requireUserId(request);
    const body = productBranchesUpdateSchema.parse(request.body);
    return {
      products: await setProductBranches(userId, request.params.id, body),
    };
  });

  app.get<{ Params: { id: string } }>('/branches/:id/products', async (request) => {
    const userId = await requireUserId(request);
    return { products: await listBranchProducts(userId, request.params.id) };
  });

  app.put<{ Params: { id: string } }>('/branches/:id/products', async (request) => {
    const userId = await requireUserId(request);
    const body = branchProductsBulkSchema.parse(request.body);
    return bulkSetBranchProducts(userId, request.params.id, body);
  });
};
