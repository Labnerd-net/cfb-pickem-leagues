import logger from '../utils/logger.js';
import { ntfyEnabled, ntfyTopicUrl } from '../utils/envVars.js';

interface SendNtfyParams {
  title: string;
  message: string;
}

export async function sendNtfyNotification(params: SendNtfyParams): Promise<boolean> {
  if (!ntfyEnabled) {
    logger.warn('ntfy notification skipped: NTFY_TOPIC_URL not configured');
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(ntfyTopicUrl);
  } catch {
    logger.error({ ntfyTopicUrl }, 'Invalid NTFY_TOPIC_URL');
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
