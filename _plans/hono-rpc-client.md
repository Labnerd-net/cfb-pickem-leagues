# Plan: Hono RPC Client for End-to-End Type Safety

## Context

The frontend hand-writes axios calls against the backend with manual type assertions. A backend response shape change produces a silent runtime failure, not a compile error. The fix is Hono's built-in RPC layer: routes export an `AppType` that the frontend's `hc()` client uses to validate request/response shapes at build time.

The spec also requires removing the `ok(data)` / `err(msg, code)` response envelope so routes return data directly, giving cleaner inferred types. This is the largest surface-area change — every route handler and every frontend API function is touched.

---

## Key Constraints

- **Chained route definitions required.** `typeof app` only carries route types when routes are defined with method chaining (`new Hono().get(...).post(...)`). The current code uses imperative `app.get(); app.post()` which loses types.
- **Route-level middleware replaces sub-router `.use()`.** `user.use(authMiddleware)` and `admin.use(authMiddleware)` break type chaining. Middleware goes inline per route instead: `.get('/profile', authMiddleware, handler)`.
- **No `@hono/zod-validator` in scope.** Without input validators, query parameter *names* won't be compile-checked on the client — only response shapes will be. This still satisfies the primary acceptance criterion. Input validators are a follow-up.
- **`hono` is not in frontend's `package.json`** — must be added.
- **Frontend components don't change.** API functions keep the same `{ success, data?, error? }` return shape; components are unaffected.

---

## Files to Change

### Backend
| File | Change |
|------|--------|
| `src/routes/auth.ts` | Chain route definitions; remove `ok()/err()`; use `HTTPException` for errors; return data directly |
| `src/routes/user.ts` | Same; move `user.use(authMiddleware)` inline per route |
| `src/routes/admin.ts` | Same; move `admin.use(authMiddleware)` + `requireRole` inline per route |
| `src/index.ts` | Chain `.route()` calls on a typed sub-app; add `app.onError()` handler; export `AppType` |
| `src/utils/response.ts` | Delete — no longer used |

### Frontend
| File | Change |
|------|--------|
| `package.json` | Add `hono` dependency |
| `tsconfig.app.json` | Add `"@backend/*": ["../backend/src/*"]` to `paths` |
| `vite.config.ts` | Add `@backend` resolve alias |
| `vitest.config.ts` | Add `@backend` resolve alias (mirrors vite config) |
| `src/lib/api.ts` | **New file** — `hc<AppType>()` client instance |
| `src/apis/authRequests.ts` | Replace axios calls with typed `client` |
| `src/apis/userRequests.ts` | Replace axios calls with typed `client` |
| `src/apis/adminRequests.ts` | Replace axios calls with typed `client` |
| `tests/mocks/handlers.ts` | Return data directly (remove `ok: true, data: {...}` envelope) |
| `tests/unit/apis/authRequests.test.ts` | Update assertions for new response shape |
| `tests/unit/apis/adminRequests.test.ts` | Update assertions for new response shape |

---

## Implementation Steps

### 1. Backend — Chain route definitions and strip envelope

Convert each route file from imperative to chained syntax, remove `ok()/err()`, and use `HTTPException` for error responses. The 500-error boilerplate in every try/catch block can be removed by re-throwing — the global `onError` handler in `index.ts` catches it.

**auth.ts before:**
```ts
const auth = new Hono<{ Variables: Variables }>()
auth.post('/login', authRateLimit, async c => {
  ...
  return c.json(ok({}))
})
```

**auth.ts after:**
```ts
import { HTTPException } from 'hono/http-exception'

const auth = new Hono<{ Variables: Variables }>()
  .post('/login', authRateLimit, async c => {
    ...
    if (!isValid) throw new HTTPException(401, { message: 'Invalid credentials' })
    ...
    return c.json({})   // data directly
  })
export default auth
```

**user.ts — middleware moves inline:**
```ts
const user = new Hono<{ Variables: Variables }>()
  .get('/profile', authMiddleware, async c => { ... return c.json(profile) })
  .get('/picks',   authMiddleware, async c => { ... return c.json({ picks }) })
  .get('/weeks',   authMiddleware, async c => { ... return c.json({ weeks }) })
  .get('/games',   authMiddleware, async c => { ... return c.json({ pickedGames }) })
  .post('/picks',  authMiddleware, async c => { ... return c.json({ status: 'updated picked games' }) })
export default user
```

Admin routes follow the same pattern, with `requireRole('admin')` added inline after `authMiddleware`.

### 2. Backend — Export AppType, add global error handler

In `src/index.ts`, create a typed route sub-app separate from the middleware-only main app:

```ts
import { HTTPException } from 'hono/http-exception'

const app = new Hono()
app.use('*', cors({ ... }))
app.use(prettyJSON())
app.use(logger)
app.get('/', c => c.text('Welcome to the CFB Pickem!'))
app.notFound(c => c.json({ message: 'Not Found' }, 404))
app.get('/health', c => c.json({ status: 'UP' }))

// Typed sub-app for AppType inference
const routes = new Hono()
  .route('/api/auth', authRoutes)
  .route('/api/admin', adminRoutes)
  .route('/api/user', userRoutes)

app.route('', routes)

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  pinoLogger.error(err)
  return c.json({ error: 'An unexpected error occurred' }, 500)
})

export type AppType = typeof routes   // routes, not app (middleware doesn't carry route types)
```

### 3. Frontend — Install hono, add path aliases

```bash
pnpm add hono --filter cfb-pickem-frontend
```

`packages/frontend/tsconfig.app.json` — add to `compilerOptions.paths`:
```json
"@backend/*": ["../backend/src/*"]
```

`packages/frontend/vite.config.ts` and `packages/frontend/vitest.config.ts` — add to `resolve.alias`:
```ts
'@backend': path.resolve(__dirname, '../backend/src')
```

### 4. Frontend — Create `src/lib/api.ts`

```ts
import { hc } from 'hono/client'
import type { AppType } from '@backend/index.js'

export const client = hc<AppType>(
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  { init: { credentials: 'include' } }
)
```

This is a type-only backend import — no backend code is bundled into the frontend.

### 5. Frontend — Migrate API files

Replace axios with `client`. Keep the same `{ success, data?, error? }` return shape (components don't change). Determine success/failure from HTTP status rather than the `ok` field:

```ts
// authRequests.ts — login example
export async function loginUser(credentials: Credentials) {
  try {
    const res = await client.api.auth.login.$post({ json: credentials })
    if (!res.ok) {
      const body = await res.json() as { error: string }
      return { success: false, error: body.error }
    }
    return { success: true }
  } catch {
    return { success: false, error: 'Request failed' }
  }
}
```

Query param calls: `client.api.user.picks.$get({ query: { year: String(year), week: String(week) } })`
Path param calls: `client.api.admin.year[':year'].$post({ param: { year: String(year) } })`

### 6. Frontend — Update MSW handlers and tests

MSW handlers in `tests/mocks/handlers.ts` currently return `{ ok: true, data: {...} }`. Update to return data directly. Error handlers return `{ error: string }` with appropriate HTTP status codes (no `ok: false`).

Test assertion updates are minimal — the API functions' return shape (`{ success, data?, error? }`) stays the same, so component-level tests are unaffected. Only the MSW handler bodies and any assertions on raw response structure need updating.

---

## Verification

1. `npx tsc --noEmit -p packages/backend/tsconfig.json` — no errors
2. `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` — no errors
3. **Compile-time safety check:** rename a field in a backend `c.json({...})` response and confirm TypeScript flags an error at the corresponding `client.api.*.$get()` call site in the frontend.
4. `pnpm test:frontend` — all tests pass
5. Manual smoke test: login, register, view picks, submit picks, admin game management all work end-to-end.
