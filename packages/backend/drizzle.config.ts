import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

function getDbUrl() {
  const connString =
    process.env.NODE_ENV === 'production' ? process.env.PROD_DB : process.env.DEV_DB;
  if (connString) return connString;
  const pgUser = process.env.DB_USER || 'postgres';
  const pgPassword = process.env.DB_PASSWORD || 'postgres';
  const pgHost = process.env.DB_HOST || 'localhost';
  const pgPort = process.env.DB_PORT || '5432';
  const pgName = process.env.DB_NAME || 'cfb-pickem';
  return `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgName}`;
}
const dbUrl = getDbUrl();

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema',
  dialect: 'postgresql',
  dbCredentials: { url: dbUrl },
  schemaFilter: ['user', 'admin', 'public'],
});
