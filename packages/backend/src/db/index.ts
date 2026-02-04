import 'dotenv/config';
import { customType } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { SeasonType, Team } from '@shared/types/cfb-pickem-api.js';

export const columnSeason = customType<{data: SeasonType}>({
  dataType() {
    return 'text';
  },
});

export const columnTeam = customType<{data: Team}>({
  dataType() {
    return 'text';
  },
});

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
