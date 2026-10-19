import { authedRequest } from './authed';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(unreadOnly = false): Promise<AppNotification[]> {
  const response = await authedRequest<{ notifications: AppNotification[] }>(
    `/v1/notifications${unreadOnly ? '?unread=true' : ''}`,
  );
  return response.notifications;
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await authedRequest('/v1/notifications/read', {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
  });
}
