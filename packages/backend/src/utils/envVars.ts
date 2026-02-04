import 'dotenv/config';

const localClientURLs = [
  'http://localhost:4173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
];
const envClientURLs = process.env.CLIENT_URL?.split(',');
export const clientURLs = envClientURLs || localClientURLs;

export const serverPort = Number(process.env.SERVER_PORT) || 3000;

export const jwtSecret = process.env.JWT_SECRET || 'super‑secret‑change‑me';

export const cfbdApiKey =
  process.env.CFBD_API_KEY || 'wBt3EIZFsPwmr2GFAQZZcRiXrWgW+zQWQCSkeWe8mPAtpnVx0yN3VnPWYxnCqoOl';

// cfbd = college football data = https://collegefootballdata.com/
// ncaa = ncaa-api = https://ncaa-api.henrygd.me/openapi
// sdv = sportsdataverse = https://js.sportsdataverse.org/docs/intro
export const dataSource = process.env.DATA_SOURCE || 'ncaa';
