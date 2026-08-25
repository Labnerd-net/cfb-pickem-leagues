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
//
// Lazily initialized on first use (not at module top-level): Cloudflare's `wrangler deploy`
// startup validation runs top-level code before secret bindings are guaranteed to be populated
// into process.env, so building the Neon client eagerly can fail deploy-time validation
// (see https://developers.cloudflare.com/workers/observability/errors/#validation-errors-10021).
let _db: ReturnType<typeof drizzle> | undefined;

function getDb() {
  if (!_db) {
    const connString = process.env.NODE_ENV === 'production'
      ? process.env.PROD_DB ?? ''
      : process.env.DEV_DB ?? process.env.PROD_DB ?? '';
    _db = drizzle({ client: neon(connString) });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

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
