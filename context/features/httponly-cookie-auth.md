# Plan: httpOnly Cookie Auth

Spec: `_specs/httponly-cookie-auth.md`
Branch: `claude/feature/httponly-cookie-auth`

## Scope

9 files changed, 1 new file, 1 new test file, 1 existing test updated.

---

## Backend

### 1. `packages/backend/src/utils/envVars.ts`
- Export `isProduction = process.env.NODE_ENV === 'production'` for conditional cookie `Secure` flag.

### 2. `packages/backend/src/utils/middleware.ts`
- Replace the `hono/jwt` middleware export with a custom `authMiddleware` that:
  - Reads `getCookie(c, 'auth_token')` from the request
  - Returns `c.json(err('Unauthorized', 401), 401)` if absent
  - Calls `hono/jwt`'s `verify(token, jwtSecret, jwtAlgorithm)` manually
  - Sets `c.set('jwtPayload', payload)` on success
  - Returns 401 on `JwtTokenExpired`, `JwtTokenInvalid`, or any verify error
- Cookie attributes: `httpOnly: true`, `sameSite: 'Strict'`, `secure: isProduction`, `path: '/'`, `maxAge: jwtExpirationDays * 86400`

### 3. `packages/backend/src/routes/auth.ts`
- **`POST /login`**: After signing the JWT, call `setCookie(c, 'auth_token', token, { ... })` and return `c.json(ok({}))` — no token in body.
- **`POST /register`**: Same cookie treatment, same empty response body.
- **`POST /logout`** (new): Sets `setCookie(c, 'auth_token', '', { maxAge: 0, ... })`, returns `c.json(ok({}))`. No auth middleware required.
- **`GET /me`** (new): Protected by `authMiddleware`. Reads `jwtPayload` from context, returns `c.json(ok({ userId: payload.sub, email, displayName, roles }))`.
- **`DELETE /deleteUser`**: No change — `authMiddleware` now handles it via cookie automatically.

### 4. `packages/backend/src/index.ts`
- Add `'Set-Cookie'` to `exposeHeaders` in the CORS config (already has `credentials: true`).

---

## Frontend

### 5. `packages/frontend/src/apis/authRequests.ts`
- Remove `token` from `AuthResponse.data` interface (token no longer returned in body).
- `loginUser`: Add `withCredentials: true`; stop expecting `token` in response data.
- `registerUser`: Same.
- `deleteUser`: Remove `Authorization` header, add `withCredentials: true`.
- Add `logoutUser()`: `POST /api/auth/logout` with `withCredentials: true`.
- Add `getMe()`: `GET /api/auth/me` with `withCredentials: true`, returns `ProfileResponse`.

### 6. `packages/frontend/src/apis/userRequests.ts` and `adminRequests.ts`
- Remove all `localStorage.getItem('jwt')` reads and `Authorization: Bearer` headers from every function.
- Add `withCredentials: true` to every axios call (~8–10 calls across both files).

### 7. `packages/frontend/src/contexts/auth/AuthProvider.tsx`
- `initAuth` (on mount): Remove localStorage check. Always call `getMe()`; if successful set user state, otherwise leave as null. No localStorage cleanup needed.
- `login()`: Change signature to `login(): Promise<void>` — no `token` parameter. After a successful login the cookie is set by the server; call `getMe()` to populate user state.
- `logout()`: Call `logoutUser()` (new API function), then `setUser(null)`.

### 8. `packages/frontend/src/contexts/auth/AuthContext.tsx`
- Update `login` type signature: `login: () => Promise<void>`.

### 9. `packages/frontend/src/pages/Login.tsx` and `Registration.tsx`
- Remove `result.data.token` usage; call `await login()` with no argument.

---

## Tests

### 10. `packages/backend/tests/routes/auth.test.ts` (new file)
- `POST /login` — response does not contain `token`; `Set-Cookie` header is present with `HttpOnly` and `SameSite=Strict`.
- `GET /me` with valid cookie → 200 with full profile.
- `GET /me` with no cookie → 401.
- `GET /me` with malformed cookie → 401.
- Authenticated request (any protected route) with valid cookie → 200.
- Authenticated request with no cookie → 401.
- `POST /logout` → `Set-Cookie` clears the cookie (max-age=0 or past expiry).

### 11. `packages/backend/tests/routes/adminUsers.test.ts` (update existing)
- The `makeToken` helper still works, but requests must pass the token as a `Cookie: auth_token=<token>` header instead of `Authorization: Bearer`.

---

## Notes / Decisions from spec

- `Secure` flag is conditional on `NODE_ENV=production` to preserve local HTTP dev.
- No `Authorization: Bearer` fallback — removed entirely per spec.
- No CSRF token — `SameSite=Strict` is sufficient for this same-origin app.
- `/auth/me` returns the full profile (userId, email, displayName, roles).
- Existing localStorage sessions will be silently invalidated on deploy — acceptable per spec.
