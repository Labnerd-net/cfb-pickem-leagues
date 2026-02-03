import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';

// ------------------------------------------------------------------
// DB instance
// ------------------------------------------------------------------
const pgUser = process.env.DB_USER || 'postgres';
const pgPassword = process.env.DB_PASSWORD || 'postgres';
const pgHost = process.env.DB_HOST || 'localhost';
const pgPort = process.env.DB_PORT || '5432';
const pgName = process.env.DB_NAME || 'cfb-pickem';
const dbUrl = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgName}`;

export const db = drizzle(dbUrl);
