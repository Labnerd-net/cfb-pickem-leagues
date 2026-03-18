# Plan: DB Connection Options and Admin Bootstrap Security Fix

## Context

Two medium-security backlog items ([7], [8]):

- **[7]** `db/index.ts` builds the Postgres URL via template literal. A `DB_PASSWORD` with URL-special characters (`@`, `/`, `#`, `?`, `%`) silently malforms the URL. Fix: use structured Pool options (already done in `migrate-prod.ts` — replicate that pattern).
- **[8]** `POST /auth/register` promotes the first registrant to admin by calling `returnUsers()`, which only counts live accounts. If the sole admin deletes their account, the next registrant gets admin. Fix: count active + deleted users to determine if anyone has ever registered.

---

## Implementation Plan

### Fix [7] — `packages/backend/src/db/index.ts`

Replace the template-literal URL with a `pg.Pool` using individual connection fields, matching the existing pattern in `src/scripts/migrate-prod.ts`.

**Changes:**
1. Add `import { Pool } from 'pg'` (already a dependency).
2. Read `DB_SSL` from `process.env` (documented in CLAUDE.md but currently unwired in `db/index.ts`).
3. Build a `Pool` config object: `{ host, port, user, password, database, ssl? }`.
4. Replace `drizzle(dbUrl)` with `drizzle(pool)`.
5. Remove the now-unused `dbUrl` variable.

```
// Before
const dbUrl = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgName}`;
export const db = drizzle(dbUrl);

// After
const sslConfig = process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {};
const pool = new Pool({ host: pgHost, port: Number(pgPort), user: pgUser, password: pgPassword, database: pgName, ...sslConfig });
export const db = drizzle(pool);
```

---

### Fix [8] — `packages/backend/src/db/dbUserFunctions.ts` + `src/routes/auth.ts`

**Step 1 — Add `returnTotalUserCount()` to `dbUserFunctions.ts`:**

Query both `user.users` and `user.deleted_users` and sum their counts. Return a single number.

```ts
export async function returnTotalUserCount(): Promise<number> {
  const [activeResult] = await db.select({ count: count() }).from(users);
  const [deletedResult] = await db.select({ count: count() }).from(deletedUsers);
  return (activeResult?.count ?? 0) + (deletedResult?.count ?? 0);
}
```

**Step 2 — Update `auth.ts` register handler:**

Replace `returnUsers()` (returns array, checks `.length === 0`) with `returnTotalUserCount()` (returns number, checks `=== 0`). Add a comment explaining the intent.

```ts
// First user ever (active + deleted) gets admin. Using total count prevents re-promotion
// if the sole admin deletes their account, which would otherwise re-open the bootstrap window.
const totalEverRegistered = await dbUserFunctions.returnTotalUserCount();
const roles = totalEverRegistered === 0 ? ['user', 'admin'] : ['user'];
```

---

### Tests — `packages/backend/tests/`

**`tests/unit/db/dbUserFunctions.test.ts`** — add to existing file:
- When `users` and `deleted_users` are both empty → `returnTotalUserCount()` returns 0.
- When `users` has 1 row, `deleted_users` empty → returns 1.
- When `users` empty, `deleted_users` has 1 row → returns 1 (bootstrap window closed).
- When both have rows → returns combined count.

**`tests/routes/auth.test.ts`** — add to existing file:
- Register first user → response roles include `admin`.
- Register second user → response roles do NOT include `admin`.
- Register when `users` is empty but `deleted_users` has a row → roles do NOT include `admin`.

Use the existing PGlite mock (from `tests/setup.ts`), `cleanDatabase()`, and `seedTestData()` helpers from `tests/db-utils.ts`.

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/backend/src/db/index.ts` | Replace URL string with `Pool` config object; wire in `DB_SSL` |
| `packages/backend/src/db/dbUserFunctions.ts` | Add `returnTotalUserCount()` |
| `packages/backend/src/routes/auth.ts` | Use `returnTotalUserCount()` instead of `returnUsers()` in register handler; add comment |
| `packages/backend/tests/unit/db/dbUserFunctions.test.ts` | Add unit tests for `returnTotalUserCount()` |
| `packages/backend/tests/routes/auth.test.ts` | Add bootstrap role-assignment tests |

---

## Verification

1. `pnpm build` — must pass with no TypeScript errors.
2. `pnpm test:backend` — all tests pass, including new ones.
3. Manual smoke: start backend with a `DB_PASSWORD` containing `@` — connection must succeed.
