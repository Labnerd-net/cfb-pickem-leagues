import logger from '../utils/logger.js';

interface SendNtfyParams {
  ntfyServerUrl: string;
  userId: number;
  title: string;
  message: string;
}

export async function sendNtfyNotification(params: SendNtfyParams): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(params.ntfyServerUrl);
  } catch {
    logger.error({ userId: params.userId, ntfyServerUrl: params.ntfyServerUrl }, 'Invalid ntfy URL');
    return false;
  }

  // Extract auth token from URL credentials (e.g. https://:TOKEN@host/topic)
  const token = parsed.password || parsed.username || null;
  parsed.username = '';
  parsed.password = '';

  // If the URL already includes a topic path, use it as-is; otherwise append a per-user topic
  const hasPath = parsed.pathname !== '/' && parsed.pathname !== '';
  if (!hasPath) {
    parsed.pathname = `/cfb-pickem-${params.userId}`;
  }

  const url = parsed.toString();
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    Title: params.title,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: params.message,
    });

    if (!res.ok) {
      logger.warn({ userId: params.userId, status: res.status }, 'ntfy notification returned non-OK status');
      return false;
    }

    logger.info({ userId: params.userId, url }, 'ntfy notification sent');
    return true;
  } catch (e) {
    logger.error({ err: e, userId: params.userId }, 'sendNtfyNotification failed');
    return false;
  }
}
