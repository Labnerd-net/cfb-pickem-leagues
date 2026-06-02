import logger from '../utils/logger.js';

interface SendTelegramParams {
  botToken: string;
  chatId: string;
  title: string;
  message: string;
}

export async function sendTelegramNotification(params: SendTelegramParams): Promise<boolean> {
  if (!params.botToken || !params.chatId) {
    logger.warn('Telegram notification skipped: botToken or chatId not configured');
    return false;
  }

  const url = `https://api.telegram.org/bot${params.botToken}/sendMessage`;
  const text = `*${params.title}*\n${params.message}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: params.chatId, text, parse_mode: 'Markdown' }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body }, 'Telegram notification returned non-OK status');
      return false;
    }

    logger.info({ chatId: params.chatId }, 'Telegram notification sent');
    return true;
  } catch (e) {
    logger.error({ err: e }, 'sendTelegramNotification failed');
    return false;
  }
}
