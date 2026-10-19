import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './errors';
import { config } from './config';
import { authRoutes } from './modules/auth/routes';
import { analyticsRoutes } from './modules/analytics/routes';
import { businessRoutes } from './modules/businesses/routes';
import { catalogRoutes } from './modules/catalog/routes';
import { chatRoutes } from './modules/chat/routes';
import { discoveryRoutes } from './modules/discovery/routes';
import { fileRoutes } from './modules/files/routes';
import { notificationRoutes } from './modules/notifications/routes';
import { orderRoutes } from './modules/orders/routes';
import { paymentRoutes } from './modules/payments/routes';
import { realtimeRoutes } from './modules/realtime/routes';
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
    bodyLimit: 1024 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
  });

  await app.register(websocket);

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
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
  await app.register(analyticsRoutes, { prefix: '/v1' });
  await app.register(businessRoutes, { prefix: '/v1' });
  await app.register(catalogRoutes, { prefix: '/v1' });
  await app.register(discoveryRoutes, { prefix: '/v1' });
  await app.register(orderRoutes, { prefix: '/v1' });
  await app.register(paymentRoutes, { prefix: '/v1' });
  await app.register(chatRoutes, { prefix: '/v1' });
  await app.register(notificationRoutes, { prefix: '/v1' });
  await app.register(realtimeRoutes, { prefix: '/v1' });
  await app.register(fileRoutes, { prefix: '/v1' });
  await app.register(metaRoutes, { prefix: '/v1' });

  return app;
}
