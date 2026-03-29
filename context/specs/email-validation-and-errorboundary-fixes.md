# Spec for Email Validation and ErrorBoundary Fixes

Title: Email Validation and ErrorBoundary Fixes
Branch: claude/fix/email-validation-and-errorboundary-fixes
Spec file: context/specs/email-validation-and-errorboundary-fixes.md

## Summary

Two small cleanup items grouped for efficiency:

1. **Backlog #7** — `validateEmail()` in `packages/backend/src/utils/emailValidation.ts` has dead type guards (`!email || typeof email !== 'string'`) that can never be reached because the function signature already types `email` as `string`. TypeScript enforces the type at the call site, and all callers run Zod schema validation before calling this function.

2. **Backlog #18** — `ErrorBoundary.tsx` calls `console.error` directly in `componentDidCatch`. The rest of the frontend uses a `logger` abstraction (`src/utils/logger.ts`). The fix is either to use `logger.error` or add a code comment explaining why `console.error` is intentional here.

## Functional Requirements

### #7 — Email Validation Dead Code
- Remove the unreachable `!email || typeof email !== 'string'` guard block from `validateEmail()`.
- The function should retain the regex check and the length check (254 chars per RFC 5321) — these are reachable.
- No callers should need to change.

### #18 — ErrorBoundary Logger
- Replace `console.error` in `componentDidCatch` with `logger.error` imported from `src/utils/logger.ts`.
- The call signature should pass the same arguments: the error and `info.componentStack`.

## Possible Edge Cases

- **#18 logger level default**: The frontend logger defaults to `'off'` when `VITE_LOG_LEVEL` is unset. Switching `componentDidCatch` to `logger.error` means error boundary errors are silently dropped in production unless `VITE_LOG_LEVEL=error` is configured. This could mask real unhandled render errors.

## Acceptance Criteria

- [ ] `validateEmail` no longer contains the `!email || typeof email !== 'string'` block.
- [ ] All existing tests for `validateEmail` continue to pass.
- [ ] `ErrorBoundary.componentDidCatch` uses `logger.error` (or has a comment explaining the `console.error` exception).
- [ ] No other files need to change.
- [ ] `pnpm build` passes with no errors.

## Open Questions

- **#18**: Given the logger defaults to `'off'`, is it better to use `logger.error` (consistent but silenceable) or keep `console.error` with a comment (always visible, intentional exception)? The backlog suggests either is acceptable — confirm which the user prefers. - keep the console.error and add a comment

## Testing Guidelines

These changes are too small to warrant new test files. Verify:

- Existing `validateEmail` unit tests still pass after removing the dead guards.
- No test mocks need updating.

## Personal Opinion

Both changes are straightforward and correct. For #7, removing dead code is unambiguously right — no risk.

For #18, I lean toward **keeping `console.error` with a comment** rather than switching to `logger.error`. Error boundaries catch unhandled render crashes — exactly the kind of thing you want visible in a production browser console regardless of log level config. Silencing it behind a configurable logger is a step in the wrong direction. If the goal is consistency, the better fix is a comment documenting the intentional exception.
