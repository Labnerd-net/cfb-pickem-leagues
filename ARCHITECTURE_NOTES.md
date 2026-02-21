# Architecture Notes

Retrospective on what would change if starting this project from scratch.

---

## Things to change

### 1. User picks schema — biggest structural issue

The `user_games` table copies all game data (teams, scores, points, `winningTeam`) from `admin_games`. This is denormalization without clear benefit. When scores come in, both tables must be updated. Currently `addPickedGame` syncs game data on pick submission, but there is no mechanism to sync scores for *existing* picks when game results change. User picks will silently show stale scores.

**Fix**: User picks table should be `(userId, gameId, teamChosen)` only. Join with `admin_games` at query time. One source of truth for game state.

### 2. The `-1` sentinel for "no points"

`homePoints: game.completed ? game.homePoints : -1` — using -1 to mean null is a code smell. The column should be nullable, and null should mean "not played yet." A 0-0 game is a valid score.

### 3. End-to-end type safety

The shared types package helps, but it is still manual — drift between what the API actually returns and what the frontend expects won't be caught at the boundary. Hono ships an RPC client (`hono/client`) that generates typed API calls from route definitions. That would replace the manual `src/apis/` fetch functions and catch mismatches at compile time without adding tRPC overhead.

### 4. JWT in localStorage -- Done

Migrated to httpOnly, SameSite=Strict cookie. XSS exposure of the long-lived credential eliminated. No CSRF token needed given same-origin-only use.

### 5. Drop the multi-DB abstraction -- Done

Postgres is the only supported database. The codebase is committed to a single dialect with typed Drizzle schemas.

### 6. TanStack Query on the frontend

The manual fetch functions in `src/apis/` mean every component manages its own loading/error/refetch state. TanStack Query handles caching, background refetch (useful for score updates), optimistic updates on picks, and deduplication. Highest-leverage frontend change.

### 7. Side-effect GET routes

`GET /admin/games` silently fetches from the external API and writes to the DB if no games exist. GETs should be idempotent. Split fetch-and-store into an explicit POST action. Reads that cause writes make debugging harder.

### 8. No pick deadline enforcement

Nothing prevents a user from making or changing a pick after a game has kicked off. Game start times need to be in the schema, and the pick submission endpoint needs to enforce the deadline.

---

## Things to keep

- **Hono** — fast, type-safe, portable
- **Drizzle** — right ORM at this scale
- **Zod** — validation on both ends is correct
- **pnpm workspaces** monorepo structure is appropriate
- **Hono middleware pattern** for auth/role guard is clean
- **`shared/types` package** — right instinct; execution just needs Hono RPC to close the loop
