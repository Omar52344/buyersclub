import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_WINDOW_MINUTES = 15;
export const OTP_MAX_SENDS = 3;

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(code: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(code, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyOtp(code: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) {
    return false;
  }
  const derived = scryptSync(code, salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}
