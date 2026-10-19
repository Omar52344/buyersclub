import type { FastifyRequest } from 'fastify';
import { AppError } from '../errors';
import { verifyAccessToken } from './tokens';

export async function requireUserId(request: FastifyRequest): Promise<string> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Falta el token de sesión.', 401);
  }

  try {
    return await verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    throw new AppError('UNAUTHORIZED', 'Sesión inválida o expirada.', 401);
  }
}
