import logger from '../utils/logger.js';

interface SendNtfyParams {
  topicUrl: string;
  title: string;
  message: string;
}

export async function sendNtfyNotification(params: SendNtfyParams): Promise<boolean> {
  if (!params.topicUrl) {
    logger.warn('ntfy notification skipped: topicUrl not configured');
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(params.topicUrl);
  } catch {
    logger.error({ topicUrl: params.topicUrl }, 'Invalid ntfy topicUrl');
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

  const url = parsed.toString();
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    // ntfy Title is an HTTP header; undici rejects values with chars > 255.
    // Replace common Unicode punctuation with ASCII equivalents.
    Title: params.title.replace(/[–—]/g, '-').replace(/[^\x00-\xFF]/g, ''),
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
      logger.warn({ status: res.status }, 'ntfy notification returned non-OK status');
      return false;
    }

    logger.info({ url }, 'ntfy notification sent');
    return true;
  } catch (e) {
    logger.error({ err: e }, 'sendNtfyNotification failed');
    return false;
  }
}
