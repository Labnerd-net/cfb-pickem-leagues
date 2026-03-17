# Spec for Fix Cron Week State Reset, Settings Error Handling, and Email Transporter Reuse

Title: Fix Cron Week State Reset, Settings Error Handling, and Email Transporter Reuse
Branch: claude/fix/fix-cron-settings-email
Spec file: context/specs/fix-cron-settings-email.md

## Summary

Three independent bug/performance fixes grouped into one branch:

1. **[10] Cron week state reset** — `hardCapStart` and `lastRefreshAt` in `cronTick.ts` are module-level variables that never reset when the active week changes. If the server process spans a week boundary, `hardCapStart` from the old week will block score refreshes for the first 12 hours of the new week.

2. **[11] Settings page infinite spinner** — The `useEffect` in `Settings.tsx` calls `Promise.all(...)` with no `.catch`. If either `getNotificationSettings()` or `getBroadcastChannels()` throws, `setLoading(false)` is never called, leaving the user on an infinite spinner with no error message.

3. **[17] Email transporter singleton** — `emailSender.ts` calls `nodemailer.createTransport(...)` inside `sendEmail()` on every invocation. During bulk dispatch (e.g., rankings update sent to 30 users), this creates 30 separate SMTP connections. The transporter should be created once at module load.

## Functional Requirements

### [10] Cron week state reset
- Track the current week key (`"year-weekNumber"`) in a module-level variable `lastWeekKey`.
- At the start of each `runCronTick` call, compare the current `weekKey` to `lastWeekKey`.
- If they differ, reset `hardCapStart` and `lastRefreshAt` to `null` before proceeding, then update `lastWeekKey`.
- `scoresCompletedForWeek` already uses the weekKey pattern and does not need to change.

### [11] Settings error handling
- Wrap the `Promise.all` call in `try/catch`.
- In the `catch` block, call `setLoading(false)` so the spinner does not run indefinitely.
- Optionally set an error state to surface a user-visible message (e.g., "Failed to load settings").
- `setLoading(false)` must be called in both the success and failure paths (use `finally` or explicit calls in both branches).

### [17] Email transporter singleton
- Move `nodemailer.createTransport(...)` out of `sendEmail()` to module scope.
- The transporter should only be created when `notificationsEnabled` is true (i.e., `notificationFromEmail` is set); if not enabled, the variable can remain `null` or be guarded inside `sendEmail`.
- The `sendEmail` function should reuse the module-level transporter on every call.
- No change to the function signature or return type.

## Possible Edge Cases

### [10]
- `returnCurrentWeek` returns the same week for many ticks in a row — `lastWeekKey` check should be a no-op in this common case (no performance concern).
- If week transitions happen while a score refresh is in flight, the reset on the next tick after the refresh completes is acceptable.

### [11]
- Both requests could fail, or just one. The fix should handle either scenario gracefully.
- After a load error, the page should be renderable (not stuck in spinner), even if partial data is missing.

### [17]
- SMTP config is read from env vars at module load — this is already the case for other env vars in the file.
- If `notificationsEnabled` is false, `sendEmail` returns early before using the transporter, so a `null` transporter at module scope is fine as long as the early-return guard remains.

## Acceptance Criteria

- **[10]** After a week change, `hardCapStart` and `lastRefreshAt` are both `null` at the start of the first tick for the new week. Score refreshes are not suppressed by stale state from the prior week.
- **[11]** If either API call in the Settings `useEffect` throws, the spinner stops and the page renders (with an error state or partial content, not blank).
- **[17]** `nodemailer.createTransport` is called exactly once per process lifetime when email notifications are enabled. Sending 30 emails reuses the same transporter instance.

## Open Questions

- **[11]** Should the Settings page show a generic error message when the load fails, or just render with empty/null state? The current code already handles `null` settings gracefully by not rendering the notification checkboxes, so rendering with `null` state on error is acceptable. A minimal error message is a nice-to-have. - generic error message is good

## Testing Guidelines

Create or update test files in `./tests` as appropriate:

- **[10]** Unit test `runCronTick` (or mock `cronTick` module state): simulate two consecutive ticks with different `weekKey` values and assert that `hardCapStart` and `lastRefreshAt` are reset on the second tick.
- **[11]** Frontend test for `Settings`: mock one of the API calls to throw and assert that `loading` becomes `false` and the component does not remain in the spinner state.
- **[17]** Verify `nodemailer.createTransport` is called once at module load and not called inside `sendEmail`. This can be a simple import-time check in a unit test using a spy.

## Personal Opinion

All three are legitimate and low-risk fixes. [10] is the most impactful — it's a real bug that silently breaks score refreshes across week boundaries without a server restart, which is a realistic production scenario. [11] is a quality-of-life fix that prevents a bad UX trap. [17] is a minor performance improvement that's also just correct design; creating a new SMTP connection for every email is wasteful even at small scale.

None of these are complex. They are all small, targeted changes. Grouping them in one branch is reasonable since each is isolated to a single file.

One concern on [17]: if SMTP credentials change at runtime (unlikely but possible in some setups), a singleton transporter would use stale credentials. For this app's deployment model (env vars set at startup), this is not a practical issue.
