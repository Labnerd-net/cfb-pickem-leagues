# Plan: Email Validation and ErrorBoundary Fixes

## Context

Two small cleanup items from backlog (#7 and #18). They are grouped because each is a one or two-line change with no behavior impact.

- **#7**: `validateEmail()` has a dead guard block (`!email || typeof email !== 'string'`) at lines 19–24. TypeScript's `string` parameter type makes this unreachable, and all callers pass Zod-validated input anyway. Removing it makes the function simpler and accurate.
- **#18**: `ErrorBoundary.componentDidCatch` calls `console.error` directly. The rest of the frontend uses a `logger` abstraction, but the frontend logger defaults to `'off'`, which would silently suppress error boundary output in production. Decision per spec: keep `console.error` and add a comment documenting the intentional exception.

## Changes

### 1. `packages/backend/src/utils/emailValidation.ts`
- Delete lines 19–24 (the `if (!email || typeof email !== 'string')` block).
- No other changes needed; the function signature, regex check, and length check remain.

### 2. `packages/frontend/src/components/ErrorBoundary.tsx`
- In `componentDidCatch`, keep `console.error(...)` as-is.
- Add a comment above the call explaining that `console.error` is intentional here because error boundary errors must always be visible regardless of `VITE_LOG_LEVEL` config.

## Verification

- Run `pnpm test:backend` — existing `validateEmail` tests should still pass.
- Run `pnpm build` — no TypeScript or build errors.
- No new tests needed; changes are too small.
