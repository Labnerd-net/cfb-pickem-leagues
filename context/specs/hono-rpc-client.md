# Spec for hono-rpc-client

branch: claude/feature/hono-rpc-client

## Summary

Replace the hand-written `src/apis/` fetch functions on the frontend with Hono's built-in RPC client. Hono's RPC layer infers request and response types directly from route definitions, so any mismatch between what the API returns and what the frontend expects is caught at compile time rather than at runtime.

## Functional Requirements

- Define a single exported `AppType` from the backend that captures all route types (auth, user, admin).
- Expose the Hono RPC client via a shared entry point in the frontend (e.g. `src/lib/api.ts`) that points to the backend base URL.
- Replace every manual fetch call in `src/apis/userRequests.ts` and `src/apis/adminRequests.ts` with the typed RPC client.
- Auth headers (cookie-based JWT) must continue to work — the RPC client must send credentials with each request.
- All existing API functionality (auth, user picks, admin game management) must work identically after the migration.
- Remove the now-redundant manual type casts and response-shape assumptions in the frontend API files.

## Possible Edge Cases

- Hono RPC strips the response wrapper (`ok`/`err`) from the inferred types — the client-side handling of error responses needs to stay compatible with the existing `ok(data)` / `err(message, code)` envelope.
- Routes that use query parameters (e.g. `?year=&week=`) rather than JSON bodies need to be confirmed compatible with Hono's RPC query inference.
- The `AppType` export creates a hard build-time dependency from frontend on backend — the monorepo build order must account for this (backend types must be generated before the frontend compiles).
- Cookie credentials (`credentials: 'include'`) must be explicitly configured on the RPC client; the default fetch behavior may not send cookies cross-origin in some environments.
- Admin-only and user-only routes are defined in separate Hono sub-apps — the combined `AppType` must correctly represent all sub-routers without losing per-route type information.

## Acceptance Criteria

- `npx tsc --noEmit` passes for both backend and frontend with no new errors.
- Changing a route's response shape in the backend produces a TypeScript error in the frontend at the call site, without any manual type update.
- All existing features work end-to-end: login, registration, viewing picks, submitting picks, admin game management.
- `src/apis/userRequests.ts` and `src/apis/adminRequests.ts` contain no raw `fetch()` calls or manual response type assertions.
- No runtime behavior changes — the network requests, cookies, and response handling work identically to before.

## Open Questions

- Should the `AppType` be exported through the `packages/shared` package, or imported directly from `packages/backend` via a tsconfig path alias? Direct import avoids an extra indirection but tightens the coupling. - direct import sounds fine
- Hono RPC uses `hc()` (the typed client factory) — does this require any additional Hono packages beyond what is already installed (`hono`)? - I do not know
- The current response envelope (`ok(data)` / `err(message, code)`) is not part of Hono's RPC type inference by default. Should the envelope be kept as-is (and unwrapped manually on the client), or should routes return data directly so the inferred types are cleaner? - return data directly

## Testing Guidelines

Create or update tests in `packages/frontend/tests/` covering:

- Each migrated API function still returns the correct shape (can use existing MSW mocks).
- An error response from the server is correctly surfaced to the caller.
- Auth-required endpoints behave correctly when no session cookie is present (expect a 401 shape back).

Do not test the Hono RPC internals — only the observable behavior of the frontend API functions.

## Personal Opinion

This is a good idea and the right next step after adding the shared types package. The manual fetch functions are the weakest link in the type chain — a renamed field on a backend response currently produces a silent runtime failure, not a build error. Hono RPC closes that gap with minimal overhead compared to tRPC.

The main complexity is the response envelope. If `ok(data)` stays, the inferred response type will always be `{ ok: true, data: T } | { ok: false, error: string }` — which is actually fine and arguably cleaner than the current approach. The migration itself is mechanical but touches every frontend API call, so it carries some risk of subtle regressions. A careful, route-by-route migration with tests at each step is advisable.
