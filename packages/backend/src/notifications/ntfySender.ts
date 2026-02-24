import logger from '../utils/logger.js';

interface SendNtfyParams {
  ntfyServerUrl: string;
  userId: number;
  title: string;
  message: string;
}

export async function sendNtfyNotification(params: SendNtfyParams): Promise<boolean> {
  const topic = `cfb-pickem-${params.userId}`;
  const url = `${params.ntfyServerUrl}/${topic}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Title: params.title,
      },
      body: params.message,
    });

    if (!res.ok) {
      logger.warn({ userId: params.userId, status: res.status }, 'ntfy notification returned non-OK status');
      return false;
    }

    logger.info({ userId: params.userId, topic }, 'ntfy notification sent');
    return true;
  } catch (e) {
    logger.error({ err: e, userId: params.userId }, 'sendNtfyNotification failed');
    return false;
  }
}
