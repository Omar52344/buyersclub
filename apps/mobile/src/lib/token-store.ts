export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

const KEY = 'buyersclub.session';

export async function loadSession(): Promise<StoredSession | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(KEY);
}
