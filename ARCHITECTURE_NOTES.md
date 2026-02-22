# Architecture Notes

Retrospective on what would change if starting this project from scratch.

---

## Things to change

### 1. User picks schema — biggest structural issue -- Done

`user.games` now holds only `(userId, gameId, teamChosen, createdAt)`. `returnUserGames` joins with `admin.games` at query time, so scores updated after a pick is submitted are immediately visible without re-submitting. FK from `user.games.gameId` → `admin.games.gameId` with cascade delete prevents orphan picks.

### 2. The `-1` sentinel for "no points" -- Done

`homePoints` and `awayPoints` are now nullable (`INTEGER` with no default). `null` means "not played yet." API converters and DB functions updated accordingly. Shared types updated to `number | null`.

### 3. End-to-end type safety -- Done

The shared types package helps, but it is still manual — drift between what the API actually returns and what the frontend expects won't be caught at the boundary. Hono ships an RPC client (`hono/client`) that generates typed API calls from route definitions. That would replace the manual `src/apis/` fetch functions and catch mismatches at compile time without adding tRPC overhead.

`hono/client` is now wired up in `packages/frontend/src/lib/api.ts` using `hc<AppType>`. Typed API calls replace the manual fetch wrappers.

### 4. JWT in localStorage -- Done

Migrated to httpOnly, SameSite=Strict cookie. XSS exposure of the long-lived credential eliminated. No CSRF token needed given same-origin-only use.

### 5. Drop the multi-DB abstraction -- Done

Postgres is the only supported database. The codebase is committed to a single dialect with typed Drizzle schemas.

### 6. TanStack Query on the frontend

The manual fetch functions in `src/apis/` mean every component manages its own loading/error/refetch state. TanStack Query handles caching, background refetch (useful for score updates), optimistic updates on picks, and deduplication. Highest-leverage frontend change.

### 7. Side-effect GET routes -- Done

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
