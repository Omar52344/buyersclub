import { SignJWT } from 'jose';
import { config } from '../config';

const key = new TextEncoder().encode(config.JWT_SECRET);

export async function signFileToken(fileId: string, userId: string): Promise<string> {
  return new SignJWT({ typ: 'file', fileId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);
}

export async function buildFileUrl(fileId: string, userId: string): Promise<string> {
  const token = await signFileToken(fileId, userId);
  return `/v1/files/${fileId}?token=${encodeURIComponent(token)}`;
}
