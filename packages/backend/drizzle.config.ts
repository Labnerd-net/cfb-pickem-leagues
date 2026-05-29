import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const pgUser = process.env.DB_USER || 'postgres';
const pgPassword = process.env.DB_PASSWORD || 'postgres';
const pgHost = process.env.DB_HOST || 'localhost';
const pgPort = process.env.DB_PORT || '5432';
const pgName = process.env.DB_NAME || 'cfb-pickem';
export const dbUrl = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgName}`;

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema',
  dialect: 'postgresql',
  dbCredentials: { url: dbUrl },
  schemaFilter: ['user', 'admin', 'public'],
});
