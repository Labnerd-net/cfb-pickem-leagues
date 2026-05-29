# Plan: Multi-League Phase 1 — Schema & Migration

## Context

This is the foundation phase of converting the single-tenant CFB Pick'em app into a multi-league platform. The goal is to add the three new tables (`leagues`, `league_members`, `league_games`) and populate them with a Default League seeded from existing data — without touching any existing table definitions, routes, or frontend code.

**Key deviation from spec:** The spec includes modifying `user.games` (adding `league_id`, changing PK) in Phase 1. That change necessarily requires updating every DB function that inserts into `user.games`, which cascades into routes (TypeScript will fail to compile). Since routes are explicitly out of scope for Phase 1, `user.games` modification is deferred to Phase 3. Similarly, `admin.games.picked` is NOT dropped in Phase 1 — it stays until Phase 3 removes it alongside the code that uses it. Phase 1 is purely additive.

---

## Drizzle Config Change

**File:** `packages/backend/drizzle.config.ts`

Add `'public'` to `schemaFilter` so drizzle-kit generates migrations for the new public-schema tables:

```ts
schemaFilter: ['user', 'admin', 'public'],
```

---

## New Schema File

**File:** `packages/backend/src/db/schema/leagues.ts`

Use `pgTable` (no `pgSchema` wrapper — public is the default Postgres schema).

```ts
import { integer, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { adminGames } from './admin.js';

export const leagues = pgTable('leagues', {
  leagueId: serial('league_id').primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  createdBy: integer('created_by').notNull().references(() => users.userId),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leagueMembers = pgTable(
  'league_members',
  {
    leagueId: integer('league_id').notNull().references(() => leagues.leagueId),
    userId: integer('user_id').notNull().references(() => users.userId),
    role: text('role').notNull(),  // 'admin' | 'member'
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  table => [primaryKey({ columns: [table.leagueId, table.userId] })]
);

export const leagueGames = pgTable(
  'league_games',
  {
    leagueId: integer('league_id').notNull().references(() => leagues.leagueId),
    gameId: integer('game_id').notNull().references(() => adminGames.gameId),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  table => [primaryKey({ columns: [table.leagueId, table.gameId] })]
);
```

No other schema files change in this phase.

---

## Migration Steps

### 1. Generate the DDL migration

```bash
cd packages/backend
pnpm generate
```

This produces a new SQL file in `drizzle/` with the DDL for the three new tables.

### 2. Manually edit the generated migration to add data seeding

Insert the following DML **after** the three `CREATE TABLE` statements:

```sql
-- Seed default league from first admin user
INSERT INTO "leagues" ("name", "invite_code", "created_by")
SELECT 'Default League', 'default00', u.user_id
FROM "user"."users" u
WHERE 'admin' = ANY(u.roles)
ORDER BY u.user_id ASC
LIMIT 1;

-- Add all existing users as league members
INSERT INTO "league_members" ("league_id", "user_id", "role")
SELECT
  (SELECT league_id FROM leagues LIMIT 1),
  u.user_id,
  CASE WHEN 'admin' = ANY(u.roles) THEN 'admin' ELSE 'member' END
FROM "user"."users" u;

-- Populate league_games from currently picked admin games
INSERT INTO "league_games" ("league_id", "game_id")
SELECT
  (SELECT league_id FROM leagues LIMIT 1),
  g.game_id
FROM "admin"."games" g
WHERE g.picked = true;
```

### 3. Run the migration

```bash
pnpm migrate
```

---

## No Changes To

- `packages/backend/src/db/schema/admin.ts` — `picked` stays
- `packages/backend/src/db/schema/users.ts` — `user.games` unchanged
- All route files, DB function files, frontend files, shared types, tests

---

## Verification

1. `pnpm migrate` runs with no errors on the dev DB
2. `pnpm build` passes (no TypeScript changes means no new type errors)
3. Verify via `pnpm studio` or psql:
   - `leagues` table has one row: "Default League"
   - `league_members` has one row per user with correct roles
   - `league_games` has one row per game where `admin.games.picked = true`
4. The running app behaves identically to before (no routes changed)
