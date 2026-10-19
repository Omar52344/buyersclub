import { config } from '../config';

interface PushResult {
  invalidTokens: string[];
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<PushResult> {
  if (tokens.length === 0) {
    return { invalidTokens: [] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
    }));

    const response = await fetch(config.EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { invalidTokens: [] };
    }

    const payload = (await response.json()) as {
      data?: { status?: string; details?: { error?: string } }[];
    };

    const invalidTokens: string[] = [];
    payload.data?.forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const token = tokens[index];
        if (token) {
          invalidTokens.push(token);
        }
      }
    });

    return { invalidTokens };
  } catch {
    return { invalidTokens: [] };
  } finally {
    clearTimeout(timeout);
  }
}
