import { jwtVerify, SignJWT } from 'jose';
import { config } from '../config';

const key = new TextEncoder().encode(config.JWT_SECRET);

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.ACCESS_TOKEN_TTL)
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, key);
  if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Token de acceso inválido');
  }
  return payload.sub;
}
