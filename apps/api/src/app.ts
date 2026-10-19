import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './errors';
import { config } from './config';
import { authRoutes } from './modules/auth/routes';
import { businessRoutes } from './modules/businesses/routes';
import { catalogRoutes } from './modules/catalog/routes';
import { discoveryRoutes } from './modules/discovery/routes';
import { orderRoutes } from './modules/orders/routes';
import { healthRoutes } from './routes/health';
import { metaRoutes } from './routes/meta';

export async function buildApp(): Promise<FastifyInstance> {
  const isTest = config.NODE_ENV === 'test';

  const app = Fastify({
    logger: isTest
      ? false
      : {
          level: config.LOG_LEVEL,
          ...(config.NODE_ENV === 'development'
            ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
            : {}),
        },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: error.flatten(),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    request.log.error({ err: error }, 'request_failed');
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    return reply.status(statusCode).send({
      error: {
        code: statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message: statusCode === 500 ? 'Error interno del servidor' : error.message,
      },
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' },
    }),
  );

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1' });
  await app.register(businessRoutes, { prefix: '/v1' });
  await app.register(catalogRoutes, { prefix: '/v1' });
  await app.register(discoveryRoutes, { prefix: '/v1' });
  await app.register(orderRoutes, { prefix: '/v1' });
  await app.register(metaRoutes, { prefix: '/v1' });

  return app;
}
