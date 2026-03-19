# Spec for Notification Bulk Query and Rate Limiter Interval Cleanup

Title: Notification Bulk Query and Rate Limiter Interval Cleanup
Branch: claude/fix/notification-bulk-query-rate-limit-cleanup
Spec file: context/specs/notification-bulk-query-rate-limit-cleanup.md

## Summary

Two performance fixes:

1. **[16] Notification N+1 query** — `hasNotificationBeenSent` is called per-user in a sequential loop inside `dispatcher.ts`. For 50 users, that is 50 individual DB queries per notification event. Replace with a single bulk query that fetches all already-sent log entries for the `(year, weekNumber, notificationType, channel)` tuple, then builds a userId Set for O(1) lookups.

2. **[18] Rate limiter interval leak** — The cleanup `setInterval` in `rateLimiter.ts` is registered at module load and never cleared. This blocks graceful shutdown and leaks the interval across test suites (each import re-registers it). Export a `clearRateLimitStore()` function that calls `clearInterval` so tests and shutdown hooks can clean up properly.

## Functional Requirements

### [16] Notification Bulk Query
- Add a new DB function (e.g. `hasNotificationsBeenSentBulk`) that accepts `(year, weekNumber, notificationType, channel)` and returns a Set of userIds that already have a sent log entry for those parameters.
- Replace the per-user `hasNotificationBeenSent` calls in `dispatcher.ts` with a single call to the new bulk function before the user loop.
- The per-user `hasNotificationBeenSent` function may be kept for any other callers, or removed if unused after the refactor.
- Behavior must be identical: users with an existing log entry are still skipped.

### [18] Rate Limiter Interval Cleanup
- Export a `clearRateLimitStore()` function from `rateLimiter.ts` that clears the interval and optionally resets the in-memory store.
- The interval handle must be stored in module scope so `clearRateLimitStore()` can reference it.
- Call `clearRateLimitStore()` in the test setup/teardown for any tests that import `rateLimiter.ts`.
- No change to the production runtime behavior of the rate limiter.

## Possible Edge Cases

- **[16]** If the `notificationLog` table has no entries for the given tuple, the bulk query returns an empty Set — all users proceed, which is correct behavior.
- **[16]** If a user appears more than once in the log (shouldn't happen, but possible due to retries), the Set deduplicates them safely.
- **[18]** If `clearRateLimitStore()` is called before the interval is ever set (e.g., module loaded but interval not yet registered), it must not throw.
- **[18]** Multiple test files importing `rateLimiter.ts` — each import shares the same module-scope interval; `clearRateLimitStore()` in `afterEach` / `afterAll` must be sufficient to prevent leakage.

## Acceptance Criteria

- **[16]** A notification event dispatched to N users results in exactly 1 DB query for sent-log checks, not N.
- **[16]** Users who already have a sent log entry for the event are still correctly skipped.
- **[18]** `clearRateLimitStore()` is exported from `rateLimiter.ts` and stops the cleanup interval.
- **[18]** Existing rate limiter tests continue to pass with cleanup called in `afterEach`/`afterAll`.
- **[18]** No interval is leaked when `rateLimiter.ts` is imported in test suites.
- `pnpm build` passes with no type errors.
- All existing tests pass.

## Open Questions

- Should `clearRateLimitStore()` also zero out the in-memory request store, or just clear the interval? Clearing the store is useful in tests (clean state); for shutdown it doesn't matter. Leaning toward clearing both.
- Is there a shutdown hook in the backend entry point where `clearRateLimitStore()` should be registered for production? Worth checking `src/index.ts`.

## Testing Guidelines

Create or update test files in `packages/backend/tests/`:

- **[16]** Unit test for the new bulk DB function — confirm it returns the correct userId Set given mocked log rows; confirm empty result for no matches.
- **[16]** Integration/unit test for the dispatcher — spy on the DB layer and assert the bulk function is called once (not N times) when dispatching to multiple users.
- **[18]** Unit test for `clearRateLimitStore()` — import the module, call `clearRateLimitStore()`, and verify no interval fires afterward (use fake timers if needed).
- **[18]** Ensure existing `rateLimiter` tests call `clearRateLimitStore()` in `afterEach` or `afterAll` to prevent bleed.

## Personal Opinion

Both fixes are straightforward and clearly correct — no trade-offs.

[16] is the more impactful of the two: sequential per-user queries are a real bottleneck for any production deployment with more than a handful of users. The fix is low-risk because the bulk query is a drop-in replacement with identical semantics.

[18] is a correctness issue masquerading as performance. An uncleared interval is benign in production (the process exits anyway) but it actively pollutes test output and can cause false positives or intermittent failures. It's a small fix with outsized benefit to test reliability.

No concerns. Both are isolated changes with clear before/after behavior.
