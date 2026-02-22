# TODO — Issues & Improvements

Roughly priority-ordered within each section.

---

## Bugs

### External API failures return 500 with no detail
When `getGameData` or `getWeekData` throws, the route returns a generic 500 "An unexpected error occurred" with no context about which external API failed or why. Admin sees no actionable information.

---

### Completed games show "null" for scores when points not yet populated
**Files:** `packages/frontend/src/components/admin/GameCard.tsx:90`, `packages/frontend/src/components/user/UserPicksGameCard.tsx`

Both components render score like `Final: {game.awayTeam} {game.awayPoints} - {game.homePoints} {game.homeTeam}` guarded only by `game.completed`. If a game is marked completed before scores are written, the display reads "Final: Alabama null - null Georgia". Fix: add `game.awayPoints !== null && game.homePoints !== null` to the condition.

---

## Validation Gaps

_(none currently open)_

---

## Security

### Weak password minimum (6 characters)
**File:** `packages/backend/src/utils/passwordValidation.ts:15`

Six characters is below modern standards. Recommend 10–12 minimum, or use a strength estimator (e.g. zxcvbn) rather than a length rule alone.

---

## Missing Features / Spec Gaps

### Email notifications not implemented
**Spec:** `_specs/email-notifications.md`

Nothing from this spec exists in the codebase: no Resend integration, no `notificationPreferences` column, no `PATCH /user/notifications` endpoint, no `POST /admin/week/finalize` endpoint, no cron job.

---

### No leaderboard or scoring endpoints
No endpoint exists for:
- Viewing pick results for a week (which users got which games right)
- A per-user score/record across the season
- Any kind of standings/leaderboard

This is a core feature of a pick'em game. Without it, there's no way to determine a winner.

---

### No way for a user to view their pick history across weeks
`GET /user/picks` requires explicit `year`/`week` parameters. There is no summary endpoint showing a user's record or history.

---

## Error Handling

### TOCTTOU: picks deadline not enforced atomically
**File:** `packages/backend/src/routes/user.ts`

`now` is captured once before the check loop. If a game's startTime passes during the insert loop, the pick is accepted. A test in `picks-deadline.test.ts` documents this behavior. Fix requires wrapping the deadline check and insert in a DB transaction per game.

---

### User deletion not wrapped in a transaction
**File:** `packages/backend/src/routes/auth.ts:116-118`

`logDeletedUser` and `deleteUserById` are separate DB calls with no transaction. If `logDeletedUser` succeeds but `deleteUserById` fails, the user is logged as deleted but still exists. If `deleteUserById` succeeds but `logDeletedUser` fails, the deletion has no audit record. Wrap both in a single transaction.

---

## Code Quality / Tech Debt

_(none currently open)_

---

## Tests

_(none currently open)_
