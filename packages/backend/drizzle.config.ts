import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

function getDbUrl() {
  // Neon connection string; generate does not connect, migrate/studio require it.
  const connString =
    process.env.NODE_ENV === 'production' ? process.env.PROD_DB : process.env.DEV_DB;
  return connString ?? '';
}
const dbUrl = getDbUrl();

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema',
  dialect: 'postgresql',
  dbCredentials: { url: dbUrl },
  schemaFilter: ['user', 'admin', 'public'],
});
