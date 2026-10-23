import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('API base', () => {
  it('responde el health check', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'clubsellbuy-api' });
  });

  it('expone las monedas soportadas', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/meta' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      currencies: ['COP', 'USD'],
      defaultCurrency: 'COP',
    });
  });

  it('devuelve un error estructurado en rutas inexistentes', async () => {
    const response = await app.inject({ method: 'GET', url: '/no-existe' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
  });
});
