# Spec: Multi-League — Phase 1: Schema & Migration

## Goal

Lay the database foundation for multi-league support without breaking any existing functionality. All existing data is migrated into a single "Default League" so the app continues to work after the migration runs.

---

## New Tables

### `public.leagues`
```sql
league_id    serial PRIMARY KEY
name         text NOT NULL
invite_code  text NOT NULL UNIQUE   -- random 8-char slug
created_by   integer NOT NULL REFERENCES user.users(user_id)
created_at   timestamp DEFAULT now() NOT NULL
```

### `public.league_members`
```sql
league_id    integer NOT NULL REFERENCES leagues(league_id)  ┐ composite PK
user_id      integer NOT NULL REFERENCES user.users(user_id) ┘
role         text NOT NULL CHECK (role IN ('admin', 'member'))
joined_at    timestamp DEFAULT now() NOT NULL
```

### `public.league_games`
```sql
league_id    integer NOT NULL REFERENCES leagues(league_id)   ┐ composite PK
game_id      integer NOT NULL REFERENCES admin.games(game_id) ┘
added_at     timestamp DEFAULT now() NOT NULL
```

---

## Modified Tables

### `admin.games` — remove `picked` column
The `picked` boolean is replaced by presence in `league_games`. No data loss: the migration populates `league_games` from it before dropping it.

### `user.games` (picks) — add `league_id` column
```sql
league_id    integer NOT NULL REFERENCES leagues(league_id)
```
New composite PK: `(user_id, game_id, league_id)`.
Old PK `(user_id, game_id)` is dropped.

---

## Migration Steps (single Drizzle migration)

1. Create `public.leagues` table
2. Create `public.league_members` table
3. Create `public.league_games` table
4. Insert one row into `leagues`: name = `'Default League'`, `created_by` = user_id of the first admin user (lowest user_id with `'admin'` in roles array)
5. Insert all existing users into `league_members` with role = `'member'`; set the admin user(s) to role = `'admin'`
6. Populate `league_games` from `admin.games WHERE picked = true` using the default league id
7. Add `league_id` column to `user.games` (nullable initially)
8. Backfill `user.games.league_id` with the default league id for all existing rows
9. Add NOT NULL constraint to `user.games.league_id`
10. Drop old PK `(user_id, game_id)` from `user.games`; add new PK `(user_id, game_id, league_id)`
11. Drop `picked` column from `admin.games`

---

## Drizzle Schema Changes

### `packages/backend/src/db/schema/admin.ts`
- Remove `picked: boolean('picked').notNull()` from `adminGames`
- Remove `index('games_picked_idx')` and `index('games_year_week_picked_idx')` (both reference `picked`)

### `packages/backend/src/db/schema/users.ts`
- Add `leagueId: integer('league_id').notNull()` to `games` table
- Update composite PK from `[table.userId, table.gameId]` to `[table.userId, table.gameId, table.leagueId]`

### `packages/backend/src/db/schema/leagues.ts` (new file)
- Define `leagues` and `leagueMembers` and `leagueGames` tables in the `public` Postgres schema

---

## Acceptance Criteria

- [ ] All three new tables exist after migration runs
- [ ] Default league row exists with the correct admin creator
- [ ] All existing users are in `league_members` with correct roles
- [ ] All previously `picked = true` games appear in `league_games` for the default league
- [ ] All existing picks in `user.games` have `league_id` set to the default league
- [ ] `admin.games.picked` column no longer exists
- [ ] `pnpm build` passes with no TypeScript errors after schema file changes
- [ ] `pnpm migrate` runs cleanly on a fresh dev DB

---

## Out of Scope for This Phase

- Any route or frontend changes — those come in phases 2–5
- Any new API endpoints
- Drizzle relation helpers for the new tables (can be added in phase 2 as needed)
