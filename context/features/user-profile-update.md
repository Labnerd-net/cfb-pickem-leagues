# Plan: User Profile Update

## Context

Users have no way to change their display name or password after registration. This adds `PATCH /user/profile` (backend) and profile editing forms to the Settings page (frontend). On success the backend re-issues the JWT cookie so `AuthContext` picks up the new display name without a page reload.

---

## Files to Change

| File | Change |
|------|--------|
| `packages/shared/types/cfb-pickem-api.ts` | Add `UpdateProfileRequest` interface |
| `packages/backend/src/utils/zValidate.ts` | Add `updateProfileValidator` Zod schema + export |
| `packages/backend/src/db/dbUserFunctions.ts` | Add `updateUserProfile()` DB function |
| `packages/backend/src/routes/user.ts` | Add `PATCH /profile` route |
| `packages/frontend/src/apis/userRequests.ts` | Add `updateUserProfile()` API function |
| `packages/frontend/src/pages/Settings.tsx` | Add Profile section (display name + password change forms) |
| `packages/backend/tests/routes/userProfile.test.ts` | New route test file |
| `packages/frontend/tests/userProfile.test.ts` | New frontend Zod schema test file |

---

## Step-by-Step Implementation

### 1. Shared types — `packages/shared/types/cfb-pickem-api.ts`

Add at the bottom:

```ts
export interface UpdateProfileRequest {
  displayName?: string;
  currentPassword?: string;
  newPassword?: string;
}
```

---

### 2. Zod validator — `packages/backend/src/utils/zValidate.ts`

Add schema and export:

```ts
const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const hasCurrent = val.currentPassword !== undefined;
    const hasNew = val.newPassword !== undefined;
    if (hasCurrent !== hasNew) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currentPassword and newPassword must both be provided together',
      });
    }
    if (!val.displayName && !hasCurrent && !hasNew) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
      });
    }
  });

export const updateProfileValidator = zValidator('json', updateProfileSchema);
```

---

### 3. DB function — `packages/backend/src/db/dbUserFunctions.ts`

Add `updateUserProfile()`:

```ts
export async function updateUserProfile(
  userId: number,
  fields: { displayName?: string; passwordHash?: string }
): Promise<UserDbData[]> {
  const rows = await db
    .update(users)
    .set({ ...fields })
    .where(eq(users.userId, userId))
    .returning();
  return rows.map(r => ({ ...r, emailVerified: r.emailVerified ?? false }));
}
```

---

### 4. Route — `packages/backend/src/routes/user.ts`

Add `.patch('/profile', apiRateLimit, authMiddleware, updateProfileValidator, async c => {...})` after the existing GET `/profile` handler. Key logic:

1. Get `jwtPayload.sub` (userId)
2. If `currentPassword` and `newPassword` present:
   - Fetch user via `returnUserById(userId)` — throw 404 if missing
   - `bcrypt.compare(currentPassword, user[0].passwordHash)` — throw 401 if mismatch
   - `validatePassword(newPassword)` — throw 400 if invalid
   - Hash new password: `bcrypt.hash(newPassword, bcryptSaltRounds)`
3. Build update object (`displayName` if provided, `passwordHash` if password change)
4. Call `updateUserProfile(userId, updateFields)` — returns updated row
5. Re-issue JWT cookie using same pattern as login (build payload from updated row, `sign()`, `setCookie()`)
6. Return `c.json({ status: 'updated' })`

Import `updateProfileValidator` from `zValidate.ts` and `updateUserProfile` from `dbUserFunctions.ts`. Also import `bcrypt`, `sign`, `setCookie`, and the cookie/JWT env vars (already imported in `auth.ts` — copy the same imports).

**Cookie re-issue** follows login exactly:
```ts
const payload = {
  sub: updated[0].userId,
  email: updated[0].email,
  displayName: updated[0].displayName,
  roles: updated[0].roles,
  emailVerified: updated[0].emailVerified ?? false,
  exp: getJwtExpirationSeconds(),
};
const token = await sign(payload, jwtSecret, jwtAlgorithm);
setCookie(c, 'auth_token', token, cookieOptions);
```

`cookieOptions` is defined in `auth.ts` — move it to `envVars.ts` or just re-declare it inline in `user.ts` using the same values.

---

### 5. Frontend API — `packages/frontend/src/apis/userRequests.ts`

Add:

```ts
export async function updateUserProfile(
  data: UpdateProfileRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await client.api.user.profile.$patch({ json: data });
    if (!res.ok) return { success: false, error: await extractError(res) };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}
```

Import `UpdateProfileRequest` from shared types.

---

### 6. Frontend Settings page — `packages/frontend/src/pages/Settings.tsx`

Add a **Profile** section above the existing Account section:

**Display name form** (React Hook Form + Zod):
- Schema: `z.object({ displayName: z.string().trim().min(1, '...').max(50, '...') })`
- Pre-fill with `user?.displayName` via `useForm({ defaultValues: { displayName: user?.displayName ?? '' } })`
- On submit: call `updateUserProfile({ displayName })` → on success call `login()` to refresh auth context

**Change password form** (separate `useForm`):
- Schema: `z.object({ currentPassword: z.string().min(1, '...'), newPassword: z.string().min(8, '...').max(72, '...') })`
- On submit: call `updateUserProfile({ currentPassword, newPassword })` → on success show success message (no auth context refresh needed)

Both forms show inline success (`Typography color="success.main"`) and error (`Typography color="error"`) feedback. Use `isSubmitting` from RHF to disable the submit button during the request.

Call `login()` from `const { user, login } = useAuth()` — this re-fetches `/api/auth/me` from the updated JWT cookie, updating display name in auth context.

---

## Tests

### Backend — `packages/backend/tests/routes/userProfile.test.ts`

Follow the PATCH pattern in `notifications.test.ts`. Use `makeToken()` helper, seed a test user via `addUser()`.

Cases:
- `PATCH /api/user/profile` with `{ displayName: "New Name" }` → 200, `set-cookie` header present
- `PATCH /api/user/profile` with correct password change → 200
- `PATCH /api/user/profile` with wrong `currentPassword` → 401
- `PATCH /api/user/profile` with empty body `{}` → 400
- `PATCH /api/user/profile` with only `newPassword` (missing `currentPassword`) → 400
- `PATCH /api/user/profile` with `displayName` > 50 chars → 400
- `PATCH /api/user/profile` without auth cookie → 401

### Frontend — `packages/frontend/tests/userProfile.test.ts`

Validate Zod schemas directly (no MSW needed):
- Display name empty → invalid
- Display name 51 chars → invalid
- Display name 50 chars → valid
- New password 7 chars → invalid
- New password 8 chars → valid
- New password 73 chars → invalid

---

## Verification

1. `pnpm build` — must pass with no type errors
2. Backend tests: `cd packages/backend && pnpm test`
3. Frontend tests: `cd packages/frontend && pnpm test`
4. Manual: log in, go to Settings, change display name → navbar reflects new name immediately; change password → can log in with new password

---

## Notes

- `cookieOptions` is currently defined locally in `auth.ts`. Rather than moving it, just re-declare it inline in the `user.ts` PATCH handler (same 4 values: `httpOnly`, `sameSite`, `secure`, `path`, `maxAge`).
- The `sign`, `setCookie`, `jwtSecret`, `jwtAlgorithm`, `getJwtExpirationSeconds`, `isProduction`, `jwtExpirationDays`, `bcryptSaltRounds` are all importable from existing modules — no new env vars needed.
