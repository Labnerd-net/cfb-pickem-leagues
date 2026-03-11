import 'dotenv/config';
import type { AlgorithmTypes } from 'hono/jwt';

const localClientURLs = [
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
];
const envClientURLs = process.env.CLIENT_URL?.split(',');
export const clientURLs = envClientURLs || localClientURLs;

export const serverPort = Number(process.env.SERVER_PORT) || 3000;

// JWT Configuration
if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in your .env file.');
}

export const jwtSecret = process.env.JWT_SECRET;
export const jwtAlgorithm = (process.env.JWT_ALGORITHM || 'HS256') as AlgorithmTypes;
export const jwtExpirationDays = Number(process.env.JWT_EXPIRATION_DAYS) || 7;

// Helper function to calculate JWT expiration (call this when creating tokens)
export function getJwtExpirationSeconds(): number {
  return Math.floor(Date.now() / 1000) + jwtExpirationDays * 24 * 60 * 60;
}

export const bcryptSaltRounds = Number(process.env.JWT_SALT_ROUNDS) || 10;

// cfbd = college football data = https://collegefootballdata.com/
// ncaa = ncaa-api = https://ncaa-api.henrygd.me/openapi
// sdv = sportsdataverse = https://js.sportsdataverse.org/docs/intro
// External Data Source Configuration
export const dataSource = process.env.DATA_SOURCE || 'ncaa';

// Validate CFBD API key if using CFBD as data source
if (dataSource === 'cfbd' && !process.env.CFBD_API_KEY) {
  throw new Error(
    'FATAL: CFBD_API_KEY environment variable is required when DATA_SOURCE=cfbd. Get your key at https://collegefootballdata.com/'
  );
}

export const cfbdApiKey = process.env.CFBD_API_KEY || '';

export const logLevel = process.env.LOG_LEVEL ?? 'info';

export const isProduction = process.env.NODE_ENV === 'production';

// Dev-only: override the current time for simulation (ignored in production).
// Set to an ISO 8601 string, e.g. DEV_CURRENT_TIME=2024-08-31T10:00:00Z
// Used by getNow() in src/utils/clock.ts
export const devCurrentTime = isProduction ? undefined : process.env.DEV_CURRENT_TIME;

// Set to 'true' to bypass pick deadline enforcement (useful for off-season testing)
export const ignorePickDeadline = process.env.PICKS_IGNORE_DEADLINE === 'true';

// Notification / SMTP configuration
export const notificationFromEmail = process.env.NOTIFICATION_FROM_EMAIL || '';
export const smtpHost = process.env.SMTP_HOST || '';
export const smtpPort = Number(process.env.SMTP_PORT) || 587;
export const smtpUser = process.env.SMTP_USER || '';
export const smtpPass = process.env.SMTP_PASS || '';
export const smtpSecure = process.env.SMTP_SECURE === 'true';
export const notificationsEnabled = notificationFromEmail !== '' && smtpHost !== '';
// Set to 'true' in dev to skip sending emails
export const skipEmailSend = process.env.SKIP_EMAIL_SEND === 'true';

// Broadcast notification channels (admin-configured)
export const ntfyTopicUrl = process.env.NTFY_TOPIC_URL || '';
export const ntfyEnabled = ntfyTopicUrl !== '';

export const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
export const telegramChatId = process.env.TELEGRAM_CHAT_ID || '';
export const telegramEnabled = telegramBotToken !== '' && telegramChatId !== '';
// Public-facing invite link shown to users in Settings (e.g. https://t.me/yourchannel)
export const telegramInviteUrl = process.env.TELEGRAM_INVITE_URL || '';

export const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
export const discordEnabled = discordWebhookUrl !== '';
// Public-facing invite link shown to users in Settings (e.g. https://discord.gg/abc123)
export const discordInviteUrl = process.env.DISCORD_INVITE_URL || '';
