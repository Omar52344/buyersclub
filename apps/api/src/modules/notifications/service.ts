import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/index';
import { deviceTokens, notifications } from '../../db/schema';
import { sendExpoPush } from '../../lib/push';

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function notifyUser(
  userId: string,
  input: NotificationInput,
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
    });

    const rows = await db
      .select({ token: deviceTokens.expoPushToken })
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId));

    if (rows.length === 0) {
      return;
    }

    const tokens = rows.map((row) => row.token);
    const { invalidTokens } = await sendExpoPush(
      tokens,
      input.title,
      input.body,
      input.data ?? {},
    );

    if (invalidTokens.length > 0) {
      await db
        .delete(deviceTokens)
        .where(inArray(deviceTokens.expoPushToken, invalidTokens));
    }
  } catch (error) {
    console.error('[notifications] no se pudo notificar', error);
  }
}

export async function listNotifications(userId: string, unreadOnly: boolean) {
  return db
    .select()
    .from(notifications)
    .where(
      unreadOnly
        ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
        : eq(notifications.userId, userId),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  if (ids && ids.length > 0) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)));
  } else {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }
  return { ok: true };
}

export async function registerDevice(
  userId: string,
  input: { expoPushToken: string; platform: 'ios' | 'android'; appVersion?: string },
) {
  await db
    .insert(deviceTokens)
    .values({
      userId,
      expoPushToken: input.expoPushToken,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: deviceTokens.expoPushToken,
      set: {
        userId,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        lastSeenAt: new Date(),
      },
    });
  return { ok: true };
}

export async function removeDevice(userId: string, token: string) {
  await db
    .delete(deviceTokens)
    .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.expoPushToken, token)));
  return { ok: true };
}
