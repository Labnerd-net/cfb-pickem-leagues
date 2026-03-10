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

  // Extract auth credentials from URL and build Authorization header
  // https://USER:TOKEN@host  → Basic auth
  // https://:TOKEN@host      → Bearer token
  const { username, password } = parsed;
  parsed.username = '';
  parsed.password = '';

  let authHeader: string | null = null;
  if (username && password) {
    authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  } else if (password) {
    authHeader = `Bearer ${password}`;
  } else if (username) {
    authHeader = `Bearer ${username}`;
  }

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
  if (authHeader) {
    headers['Authorization'] = authHeader;
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
