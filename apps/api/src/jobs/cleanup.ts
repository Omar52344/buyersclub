import { lt } from 'drizzle-orm';
import { db } from '../db/index';
import { guestOrderThrottles, refreshTokens, verifications } from '../db/schema';

async function cleanup(): Promise<void> {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);
  try {
    await db.delete(verifications).where(lt(verifications.createdAt, twoDaysAgo));
    await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, now));
    await db
      .delete(guestOrderThrottles)
      .where(lt(guestOrderThrottles.lastOrderAt, new Date(now.getTime() - 7 * 86_400_000)));
  } catch (error) {
    console.error('[cleanup] no se pudo limpiar', error);
  }
}

/** Limpieza periódica de OTPs y refresh tokens vencidos. */
export function startCleanupJob(): void {
  void cleanup();
  const timer = setInterval(() => {
    void cleanup();
  }, 24 * 60 * 60 * 1000);
  timer.unref();
}
