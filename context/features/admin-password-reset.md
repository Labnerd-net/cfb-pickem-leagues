# Plan: Admin Password Reset

## Context

Admins need a way to reset a user's password when the user can't log in or has forgotten their credentials. There is no self-service forgot-password flow, so the admin sets a new password directly and communicates it to the user out-of-band.

## Backend Changes

### 1. `packages/backend/src/db/dbUserFunctions.ts`
Add `updateUserPassword(userId: number, passwordHash: string): Promise<boolean>`:
- `UPDATE user.users SET password_hash = $1 WHERE user_id = $2 RETURNING user_id`
- Return `true` if a row was returned, `false` if not (user not found)

### 2. `packages/backend/src/utils/zValidate.ts`
Add and export `resetPasswordParamValidator` and `resetPasswordBodyValidator`:
- param: `{ id: z.coerce.number().int().positive() }`
- body: `{ password: z.string().min(1) }`

### 3. `packages/backend/src/routes/admin.ts`
Add after the `/users/:id/roles` PATCH:
- `PATCH /users/:id/password`
- authMiddleware, requireRole('admin'), param + body validators
- Block if jwtPayload.sub === targetId → 403 "Cannot reset your own password"
- validatePassword(password) → 400 on failure
- bcrypt.hash(password, bcryptSaltRounds)
- updateUserPassword(targetId, hash) → 404 if not found
- return c.json({ status: 'password updated' })

### 4. `packages/backend/tests/routes/adminUsers.test.ts`
Add test cases: 401, 403 non-admin, 403 self-reset, 404, 400 too short, 400 too long, 200 happy path

## Frontend Changes

### 5. `packages/frontend/src/apis/adminRequests.ts`
Add `resetUserPassword(userId: number, password: string)` via Hono RPC client.

### 6. `packages/frontend/src/components/admin/ResetPasswordDialog.tsx` (new file)
Self-contained dialog mirroring BroadcastDialog pattern. Fields: password + confirm. Submit disabled unless both non-empty, matching, and 8–72 chars.

### 7. `packages/frontend/src/components/admin/UsersSection.tsx`
Add `resetTarget` state. Add "Reset Password" button per row (hidden for self). Show success alert after close. Render ResetPasswordDialog.
