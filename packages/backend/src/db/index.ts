import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { customType } from 'drizzle-orm/pg-core';
import type { Role, SeasonType, Team } from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// DB instance
// ------------------------------------------------------------------
// In test, PGlite is injected via vi.mock('src/db/index.ts') — this module is not evaluated.
//
// `wrangler deploy` bundles with esbuild statically inlining `process.env.NODE_ENV` to the
// literal "production" at build time (standard NODE_ENV-define behavior, same as
// React/webpack) — so any runtime read of process.env.NODE_ENV in deployed Worker code
// always evaluates to "production", regardless of the actual environment. Also,
// nodejs_compat_populate_process_env does not reliably populate secret-type bindings (only
// plain `vars`) into process.env. Both were verified empirically against a live Worker.
//
// worker.ts calls syncDbEnv(env) at the top of every fetch/scheduled invocation with the
// real `env` binding object (not process.env) so the prod/dev decision and DB connection
// strings are correct in the deployed Worker, the same way reinitializeSecrets() already
// handles JWT_SECRET/CFBD_API_KEY. _isProduction defaults from process.env.NODE_ENV for
// local Node.js dev (tsx/dotenv), where that read is not bundler-inlined.
let _isProduction = process.env.NODE_ENV === 'production';

export function syncDbEnv(env: Record<string, string | undefined>): void {
  if (env.DEV_DB !== undefined) process.env.DEV_DB = env.DEV_DB;
  if (env.PROD_DB !== undefined) process.env.PROD_DB = env.PROD_DB;
  if (env.NODE_ENV !== undefined) _isProduction = env.NODE_ENV === 'production';
}

// Lazily initialized on first use (not at module top-level): Cloudflare's `wrangler deploy`
// startup validation runs top-level code before bindings are guaranteed to be populated,
// so building the Neon client eagerly can fail deploy-time validation
// (see https://developers.cloudflare.com/workers/observability/errors/#validation-errors-10021).
let _db: ReturnType<typeof drizzle> | undefined;

function getDb() {
  if (!_db) {
    const connString = _isProduction
      ? process.env.PROD_DB ?? ''
      : process.env.DEV_DB ?? process.env.PROD_DB ?? '';
    _db = drizzle({ client: neon(connString) });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, real);
    // `db.method()` calls the retrieved function with `this` bound to the
    // Proxy, not to `real` — rebind so internal `this.session`/`this.dialect`
    // references inside drizzle's methods resolve correctly.
    return typeof value === 'function' ? value.bind(real) : value;
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
