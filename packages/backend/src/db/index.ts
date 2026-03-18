import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { customType } from 'drizzle-orm/pg-core';
import type { Role, SeasonType, Team } from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// DB instance
// ------------------------------------------------------------------
const pgUser = process.env.DB_USER || 'postgres';
const pgPassword = process.env.DB_PASSWORD || 'postgres';
const pgHost = process.env.DB_HOST || 'localhost';
const pgPort = process.env.DB_PORT || '5432';
const pgName = process.env.DB_NAME || 'cfb-pickem';
const sslConfig = process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {};

const pool = new Pool({
  host: pgHost,
  port: Number(pgPort),
  user: pgUser,
  password: pgPassword,
  database: pgName,
  ...sslConfig,
});

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
