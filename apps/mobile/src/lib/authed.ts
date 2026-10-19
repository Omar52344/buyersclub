import { ApiError, bearer, fetchApi } from './api';
import { loadSession, saveSession } from './token-store';

/** Fetch autenticado con un reintento tras refrescar el access token. */
export async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const stored = await loadSession();
  if (!stored) {
    throw new ApiError(401, 'NO_SESSION', 'No hay una sesión activa.');
  }

  const run = (token: string) =>
    fetchApi<T>(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...bearer(token),
      },
    });

  try {
    return await run(stored.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    const refreshed = await fetchApi<{ accessToken: string; refreshToken: string }>(
      '/v1/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      },
    );
    await saveSession({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    });
    return run(refreshed.accessToken);
  }
}
