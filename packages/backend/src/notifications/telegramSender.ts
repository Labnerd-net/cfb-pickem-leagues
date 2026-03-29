import logger from '../utils/logger.js';
import { telegramEnabled, telegramBotToken, telegramChatId } from '../utils/envVars.js';

interface SendTelegramParams {
  title: string;
  message: string;
}

const TELEGRAM_API_URL = telegramBotToken
  ? `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
  : null;

export async function sendTelegramNotification(params: SendTelegramParams): Promise<boolean> {
  if (!telegramEnabled || !TELEGRAM_API_URL) {
    logger.warn('Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured');
    return false;
  }

  const url = TELEGRAM_API_URL;
  const text = `*${params.title}*\n${params.message}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChatId, text, parse_mode: 'Markdown' }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body }, 'Telegram notification returned non-OK status');
      return false;
    }

    logger.info({ chatId: telegramChatId }, 'Telegram notification sent');
    return true;
  } catch (e) {
    logger.error({ err: e }, 'sendTelegramNotification failed');
    return false;
  }
}
