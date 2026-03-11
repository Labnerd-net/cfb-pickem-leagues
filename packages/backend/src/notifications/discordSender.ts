import logger from '../utils/logger.js';
import { discordEnabled, discordWebhookUrl } from '../utils/envVars.js';

interface SendDiscordParams {
  title: string;
  message: string;
}

export async function sendDiscordNotification(params: SendDiscordParams): Promise<boolean> {
  if (!discordEnabled) {
    logger.warn('Discord notification skipped: DISCORD_WEBHOOK_URL not configured');
    return false;
  }

  const content = `**${params.title}**\n${params.message}`;

  try {
    const res = await fetch(discordWebhookUrl, {
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
