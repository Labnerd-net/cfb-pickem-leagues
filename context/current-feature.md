# Current Feature

## Current Feature Spec File

Title:
Spec file:
Branch:

## Current Feature Plan File

Plan File:

## History

<!-- Keep this updated. Earliest to latest -->
- **Auth and Input Validation Security Fixes** (backlog #1, #4, #5, #6): Added `game.picked` enforcement on `POST /user/picks`; applied `zValidator` to `POST /auth/register` and `POST /auth/login`; raised password min to 8 chars and enforced max 72 (bcrypt truncation limit); fixed middleware ordering on 6 routes so `authMiddleware` runs before validators; updated frontend registration schema to match.
- **Picks Transaction Rollback and Weeks Unique Constraint** (backlog #9, #12): Wrapped `POST /user/picks` inserts in `db.transaction()` via new `addPickedGamesBatch` — partial pick commits on mid-batch failure are no longer possible. Confirmed backlog [12] false positive: `admin.weeks(year, week_number)` primary key already enforces uniqueness.
- **Cron Week Reset, Settings Error Handling, Email Transporter Singleton** (backlog #10, #11, #17): Added `lastWeekKey` tracking to `cronTick.ts` so `hardCapStart` and `lastRefreshAt` reset when the active week changes. Wrapped Settings `useEffect` in `try/finally` with `loadError` state to prevent infinite spinner on network failure. Moved `nodemailer.createTransport` to module scope in `emailSender.ts` as a conditional singleton.
- **Email XSS and Rate Limiter IP Spoofing Fix** (backlog #2, #3): Added `escapeHtml()` helper in `templates.ts` and applied it to `displayName` in `rankingsUpdatedTemplate` to prevent stored XSS in leaderboard emails. Added `TRUST_PROXY` env var (default `false`) to `envVars.ts`; rate limiter now uses socket remote address when `TRUST_PROXY=false`, preventing IP spoofing on auth endpoints. Unit tests added for both fixes.
- **DB Connection Options and Admin Bootstrap Security Fix** (backlog #7, #8): Replaced template-literal Postgres URL with structured `pg.Pool` config object in `db/index.ts`, wiring in `DB_SSL` support — passwords with special characters no longer malform the connection string. Added `returnTotalUserCount()` to `dbUserFunctions.ts` that sums active + deleted users; `POST /auth/register` now uses this count for the admin bootstrap check, preventing privilege re-escalation if the sole admin deletes their account. Unit and route tests added for both fixes.
- **Error Boundary Hookup and Dead Code Removal** (backlog #13, #14): Wired `<ErrorBoundary>` into `App.tsx` wrapping `<BrowserRouter>` so unhandled render errors show a fallback UI instead of a blank screen. Removed dead `addGameToWeek` function from `dbAdminFunctions.ts` — all callers already used `upsertGameForWeek`.
- **Picks N+1 Query and Start Time Index Performance Fix** (backlog #15, #19): Replaced per-pick `returnGame` loop in `POST /user/picks` with a single `returnGamesBulk` bulk fetch using `inArray`; removed redundant `returnGame` call inside `addPickedGame`. Added `index('games_start_time_idx')` on `admin.games.startTime` and applied migration. Fixed pre-existing malformed `0002_snapshot.json` index column format blocking `drizzle-kit generate`.
- **Notification Bulk Query and Rate Limiter Interval Cleanup** (backlog #16, #18): Replaced per-user `hasNotificationBeenSent` loop in `dispatcher.ts` with a single `returnSentNotificationUserIds` bulk query returning a `Set<number>` — N email-channel queries reduced to 1. Stored the `setInterval` handle in `rateLimiter.ts` and extended `clearRateLimitStore()` to call `clearInterval`, preventing interval leaks in test suites and enabling graceful shutdown. Tests added for both changes.