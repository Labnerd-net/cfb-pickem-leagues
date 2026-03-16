# Plan: Auth and Input Validation Security Fixes

## Context

Four security issues were identified in backlog items #1, #4, #5, #6:
- A user can pick any game in `admin.games` regardless of whether the admin curated it for the week
- `POST /register` and `POST /login` crash with 500 on malformed JSON instead of returning 400
- Passwords as short as 6 characters are accepted; bcrypt silently truncates above 72 bytes with no error
- On several routes, Zod validators run before `authMiddleware`, leaking schema details to unauthenticated callers

---

## Steps

### Step 1 — `passwordValidation.ts`: raise min to 8, add max 72

**File:** `packages/backend/src/utils/passwordValidation.ts`

- Change `MIN_LENGTH` from `6` to `8`
- Add `MAX_LENGTH = 72`
- Add check: if `password.length > MAX_LENGTH` return `{ valid: false, error: 'Password must be 72 characters or fewer' }`
- Add a comment explaining that 72 is the bcrypt input truncation limit and that existing users with longer passwords were silently hashed at 72 bytes — no migration needed, but they will need to reset if they hit the new limit

Order: min check first, then max check.

---

### Step 2 — `zValidate.ts`: add register and login validators

**File:** `packages/backend/src/utils/zValidate.ts`

Add two new Zod schemas and export their validators:

```
registerRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  displayName: z.string().min(1).max(50),
})

loginRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})
```

Keep these minimal — structural presence only. Domain validation (`validateEmail`, `validatePassword`) stays in the route handler. Export as `registerRequestValidator` and `loginRequestValidator`.

---

### Step 3 — `auth.ts`: apply validators, remove redundant manual checks

**File:** `packages/backend/src/routes/auth.ts`

- `POST /register`: add `registerRequestValidator` before the async handler. Remove the manual `if (!email || !password)` and `if (!displayName ...)` / `if (displayName.length > 50)` checks — Zod now covers presence and max length. Keep `validateEmail()` and `validatePassword()` calls. Switch from `await c.req.json()` to `c.req.valid('json')`.
- `POST /login`: add `loginRequestValidator` before the async handler. Remove the manual `if (!email || !password)` check. Switch from `await c.req.json()` to `c.req.valid('json')`.

---

### Step 4 — `user.ts`: fix game.picked check + middleware ordering

**File:** `packages/backend/src/routes/user.ts`

**Middleware ordering** (two routes):
- `POST /picks`: reorder to `apiRateLimit, authMiddleware, allUserPickedRequestValidator`
- `PATCH /notifications/preferences`: reorder to `apiRateLimit, authMiddleware, notificationPreferenceValidator`

**game.picked check on POST /picks**: Restructure the validation loop so game records are fetched regardless of `ignorePickDeadline`:

```
for (const pick of userPicks.games) {
  const gameRows = await returnGame(pick.game);
  if (!gameRows || gameRows.length === 0) throw 404;
  const game = gameRows[0];

  // Always check: game must be on the admin-curated slate
  if (!game.picked) {
    throw 422: `Game ${pick.game} is not available for picks this week.`
  }

  if (!ignorePickDeadline) {
    if (game.startTime === null) throw 422 ...
    if (getNow() >= game.startTime) throw 422 ...
  }
}
```

This replaces the two separate loops (one inside `if (!ignorePickDeadline)` and one for inserting) with a single loop that checks both `picked` and optionally deadline, then the insert loop follows.

---

### Step 5 — `admin.ts`: fix middleware ordering on all affected routes

**File:** `packages/backend/src/routes/admin.ts`

Fix ordering for all routes where validator fires before auth:

| Route | Current | Corrected |
|-------|---------|-----------|
| `PATCH /users/:id/roles` | `updateUserRolesValidator, authMiddleware, requireRole('admin')` | `authMiddleware, requireRole('admin'), updateUserRolesValidator` |
| `POST /week` | `weekIdentifierValidator, authMiddleware, requireRole('admin')` | `authMiddleware, requireRole('admin'), weekIdentifierValidator` |
| `POST /picks` | `pickedGameRequestValidator, authMiddleware, requireRole('admin')` | `authMiddleware, requireRole('admin'), pickedGameRequestValidator` |
| `POST /games/complete` | `markGameCompleteValidator, authMiddleware, requireRole('admin')` | `authMiddleware, requireRole('admin'), markGameCompleteValidator` |

---

### Step 6 — `Registration.tsx`: update frontend Zod schema

**File:** `packages/frontend/src/pages/Registration.tsx`

- `password`: change `.min(6, ...)` to `.min(8, 'Password must be at least 8 characters long')`, add `.max(72, 'Password must be 72 characters or fewer')`
- `confirmPassword`: change `.min(6, ...)` to `.min(8, ...)`

---

### Step 7 — Update and add tests

**File:** `packages/backend/tests/unit/utils/validation.test.ts`
- Update `"at least 6 characters"` assertions to `"at least 8 characters"`
- Add: `validatePassword('1234567')` (7 chars) → invalid
- Add: `validatePassword('12345678')` (8 chars) → valid
- Add: `validatePassword('a'.repeat(73))` → invalid, error contains '72'
- Add: `validatePassword('a'.repeat(72))` → valid

**File:** `packages/backend/tests/routes/auth.test.ts`
- Add: `POST /register` with missing body → 400
- Add: `POST /login` with missing body → 400

**New file:** `packages/backend/tests/routes/userPicks.test.ts`
- `POST /user/picks` unauthenticated with valid body → 401
- `POST /user/picks` with a game that has `picked = false` → 422

**File:** `packages/backend/tests/routes/adminUsers.test.ts`
- Add: `PATCH /admin/users/:id/roles` unauthenticated with valid body → 401

---

## Critical Files

- `packages/backend/src/utils/passwordValidation.ts`
- `packages/backend/src/utils/zValidate.ts`
- `packages/backend/src/routes/auth.ts`
- `packages/backend/src/routes/user.ts`
- `packages/backend/src/routes/admin.ts`
- `packages/frontend/src/pages/Registration.tsx`
- `packages/backend/tests/unit/utils/validation.test.ts`
- `packages/backend/tests/routes/auth.test.ts`
- `packages/backend/tests/routes/adminUsers.test.ts`
- New: `packages/backend/tests/routes/userPicks.test.ts`

## Verification

1. `pnpm test:backend` — all tests pass including new ones
2. `pnpm build` — no type errors
3. Manual smoke test: register with 7-char password → 400; register with 73-char password → 400; register with 8-char password → success
4. Manual: submit picks with a non-curated game ID → 422
5. Manual: hit `POST /user/picks` without a cookie → 401
