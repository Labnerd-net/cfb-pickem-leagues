# Spec for Env Var Direct Access Fixes

Title: Env Var Direct Access Fixes
Branch: claude/fix/env-var-direct-access-fixes
Spec file: context/specs/env-var-direct-access-fixes.md

## Summary

Two places in the backend read environment variables directly via `process.env` instead of using the validated constants already exported from `envVars.ts`. This bypasses centralized validation and can produce silent failures.

- **Backlog #3** — `auth.ts` lines 71 and 151 read `process.env.CLIENT_URL` to build email verification URLs. If `CLIENT_URL` is unset, `split(',')[0]` returns `undefined`, and the fallback `''` produces broken URLs like `/verify-email?token=...`.
- **Backlog #4** — `rateLimiter.ts` line 46 reads `process.env.TRUST_PROXY` on every request to decide whether to trust forwarded headers. This bypasses the validated `trustProxy` boolean in `envVars.ts` and re-parses the string each request.

Both fixes are purely mechanical: replace the direct `process.env` reads with the already-exported constants.

## Functional Requirements

- `auth.ts` must use `clientURLs[0]` (imported from `envVars.ts`) when constructing email verification URLs in both `POST /register` and `POST /resend-verification`.
- `rateLimiter.ts` must import and use the `trustProxy` boolean constant from `envVars.ts` instead of reading and parsing `process.env.TRUST_PROXY` at request time.
- No behavior change for any other part of the system.

## Possible Edge Cases

- `clientURLs[0]` could be `undefined` if `CLIENT_URL` is not set and the `localClientURLs` fallback in `envVars.ts` is empty. The fix should handle this gracefully (empty string fallback is acceptable, same as current behavior, but at least it goes through the validated path).
- The `rateLimit` factory function captures configuration at call time; the `trustProxy` import is a module-level constant and will be captured correctly when the middleware is constructed.

## Acceptance Criteria

- `auth.ts` no longer contains any direct `process.env.CLIENT_URL` access.
- `rateLimiter.ts` no longer contains any direct `process.env.TRUST_PROXY` access.
- `rateLimiter.ts` imports `trustProxy` from `envVars.ts`.
- `auth.ts` imports `clientURLs` from `envVars.ts` (it already imports other constants from there).
- `pnpm build` passes with no errors.
- Existing tests continue to pass.

## Open Questions

- None. The fix is unambiguous.

## Testing Guidelines

No new test files needed. Verify existing tests pass:
- `packages/backend/tests/` — auth route tests and rate limiter tests should cover the affected paths without modification.

If any existing test stubs `process.env.TRUST_PROXY` or `process.env.CLIENT_URL` directly, those tests may need to be updated to stub the module-level import instead.

## Personal Opinion

This is a good, necessary change. Both issues are real: the CLIENT_URL one silently breaks verification emails in misconfigured environments, and reading TRUST_PROXY per-request is wasteful and inconsistent. The fixes are trivial (two import additions and two line replacements). Low risk, no ambiguity. Recommended.
