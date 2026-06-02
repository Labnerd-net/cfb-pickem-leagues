import logger from '../utils/logger.js';

interface SendDiscordParams {
  webhookUrl: string;
  title: string;
  message: string;
}

export async function sendDiscordNotification(params: SendDiscordParams): Promise<boolean> {
  if (!params.webhookUrl) {
    logger.warn('Discord notification skipped: webhookUrl not configured');
    return false;
  }

  const content = `**${params.title}**\n${params.message}`;

  try {
    const res = await fetch(params.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body }, 'Discord notification returned non-OK status');
      return false;
    }

    logger.info('Discord notification sent');
    return true;
  } catch (e) {
    logger.error({ err: e }, 'sendDiscordNotification failed');
    return false;
  }
}
