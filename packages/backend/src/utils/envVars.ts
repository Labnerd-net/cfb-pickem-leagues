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

// Set to 'true' to bypass pick deadline enforcement (useful for off-season testing)
export const ignorePickDeadline = process.env.PICKS_IGNORE_DEADLINE === 'true';

// Notification / Resend configuration
export const notificationFromEmail = process.env.NOTIFICATION_FROM_EMAIL || '';
export const resendApiKey = process.env.RESEND_API_KEY || '';
export const notificationsEnabled = notificationFromEmail !== '' && resendApiKey !== '';
// Set to 'true' in dev to skip sending emails
export const skipEmailSend = process.env.SKIP_EMAIL_SEND === 'true';
