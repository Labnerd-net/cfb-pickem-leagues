import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { customType } from 'drizzle-orm/pg-core';
import type { Role, SeasonType, Team } from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// DB instance
// ------------------------------------------------------------------
// process.env is available in Workers via nodejs_compat + nodejs_compat_populate_process_env.
// In test, PGlite is injected via vi.mock('src/db/index.ts') — this module is not evaluated.
const connString = process.env.NODE_ENV === 'production'
  ? process.env.PROD_DB ?? ''
  : process.env.DEV_DB ?? process.env.PROD_DB ?? '';

const sql = neon(connString);
export const db = drizzle({ client: sql });

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
