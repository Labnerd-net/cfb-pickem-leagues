import 'dotenv/config';
import { z } from 'zod';
import type { AlgorithmTypes } from 'hono/jwt';

const envSchema = z
  .object({
    CLIENT_URL: z.string().optional(),
    SERVER_PORT: z.coerce.number().default(3000),

    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_ALGORITHM: z.string().default('HS256'),
    JWT_EXPIRATION_DAYS: z.coerce.number().default(7),

    CFBD_API_KEY: z.string().min(1, 'CFBD_API_KEY is required. Get your key at https://collegefootballdata.com/'),

    LOG_LEVEL: z.string().default('info'),
    NODE_ENV: z.string().optional(),
    DEV_CURRENT_TIME: z.string().optional(),
    PICKS_IGNORE_DEADLINE: z.string().optional(),
    TRUST_PROXY: z.string().optional(),

    RESEND_API_KEY: z.string().default(''),
    NOTIFICATION_FROM_EMAIL: z.string().default(''),
    SKIP_EMAIL_SEND: z.string().optional(),

    NTFY_TOPIC_URL: z.string().default(''),
    TELEGRAM_BOT_TOKEN: z.string().default(''),
    TELEGRAM_CHAT_ID: z.string().default(''),
    TELEGRAM_INVITE_URL: z.string().default(''),
    DISCORD_WEBHOOK_URL: z.string().default(''),
    DISCORD_INVITE_URL: z.string().default(''),
  })

export function validateEnv(env: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const messages = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`FATAL: Invalid environment configuration:\n${messages}`);
  }
  return result.data;
}

const env = validateEnv(process.env);

const localClientURLs = [
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
];
const envClientURLs = env.CLIENT_URL?.split(',');
export const clientURLs = envClientURLs || localClientURLs;

export const serverPort = env.SERVER_PORT;

export const jwtSecret = env.JWT_SECRET;
export const jwtAlgorithm = env.JWT_ALGORITHM as AlgorithmTypes;
export const jwtExpirationDays = env.JWT_EXPIRATION_DAYS;

// Helper function to calculate JWT expiration (call this when creating tokens)
export function getJwtExpirationSeconds(): number {
  return Math.floor(Date.now() / 1000) + jwtExpirationDays * 24 * 60 * 60;
}

// cfbd = college football data = https://collegefootballdata.com/
export const cfbdApiKey = env.CFBD_API_KEY;

export const logLevel = env.LOG_LEVEL;

export const isProduction = env.NODE_ENV === 'production';

// Dev-only: override the current time for simulation (ignored in production).
// Set to an ISO 8601 string, e.g. DEV_CURRENT_TIME=2024-08-31T10:00:00Z
// Used by getNow() in src/utils/clock.ts
export const devCurrentTime = isProduction ? undefined : env.DEV_CURRENT_TIME;

// Set to 'true' to bypass pick deadline enforcement (useful for off-season testing)
export const ignorePickDeadline = env.PICKS_IGNORE_DEADLINE === 'true';

// Set to 'true' when running behind a trusted reverse proxy (Nginx, Traefik) that sets
// x-forwarded-for. When false (default), rate limiting uses the raw socket address only.
export const trustProxy = env.TRUST_PROXY === 'true';

// Resend email configuration
export const resendApiKey = env.RESEND_API_KEY;
export const notificationFromEmail = env.NOTIFICATION_FROM_EMAIL;
export const notificationsEnabled = resendApiKey !== '' && notificationFromEmail !== '';
// Set to 'true' in dev to skip sending emails
export const skipEmailSend = env.SKIP_EMAIL_SEND === 'true';

// Broadcast notification channels (admin-configured)
export const ntfyTopicUrl = env.NTFY_TOPIC_URL;
export const ntfyEnabled = ntfyTopicUrl !== '';

export const telegramBotToken = env.TELEGRAM_BOT_TOKEN;
export const telegramChatId = env.TELEGRAM_CHAT_ID;
export const telegramEnabled = telegramBotToken !== '' && telegramChatId !== '';
// Public-facing invite link shown to users in Settings (e.g. https://t.me/yourchannel)
export const telegramInviteUrl = env.TELEGRAM_INVITE_URL;

export const discordWebhookUrl = env.DISCORD_WEBHOOK_URL;
export const discordEnabled = discordWebhookUrl !== '';
// Public-facing invite link shown to users in Settings (e.g. https://discord.gg/abc123)
export const discordInviteUrl = env.DISCORD_INVITE_URL;
