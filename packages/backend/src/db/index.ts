import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { customType } from 'drizzle-orm/pg-core';
import type { Role, SeasonType, Team } from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// DB instance
// ------------------------------------------------------------------
function getPoolConfig() {
  if (process.env.NODE_ENV !== 'test') {
    const connString =
      process.env.NODE_ENV === 'production' ? process.env.PROD_DB : process.env.DEV_DB;
    if (connString) return { connectionString: connString };
  }
  const sslConfig = process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {};
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'cfb-pickem',
    ...sslConfig,
  };
}

const pool = new Pool(getPoolConfig());

export const db = drizzle(pool);

export const columnSeason = customType<{ data: SeasonType }>({
  dataType() {
    return 'text';
  },
});

export const columnTeam = customType<{ data: Team }>({
  dataType() {
    return 'text';
  },
});

export const columnRole = customType<{ data: Role }>({
  dataType() {
    return 'text';
  },
});
