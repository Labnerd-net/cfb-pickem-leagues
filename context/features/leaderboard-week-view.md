# Plan: Leaderboard Week View

## Context

`LeaderboardSection.tsx` only shows season-level standings. `GET /leaderboard/scores` already returns per-week results (`WeekScoresEntry[]`) but has no frontend UI. This adds a Season/Week toggle to the component so users can switch between the existing season standings and a per-week breakdown.

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/frontend/src/apis/leaderboardRequests.ts` | Add `getWeekScores(year, weekNumber)` |
| `packages/frontend/src/components/user/LeaderboardSection.tsx` | Add toggle + week view |
| `packages/frontend/tests/unit/apis/leaderboardRequests.test.ts` | Tests for `getWeekScores` |
| `packages/frontend/tests/unit/components/LeaderboardSection.test.tsx` | Tests for week view |

---

## 1. `leaderboardRequests.ts` — Add `getWeekScores`

Add a `WeekScoresResponse` interface and `getWeekScores(year, weekNumber)` function following the existing `{ success, data?, error? }` pattern, calling `client.api.leaderboard.scores.$get({ query: { year: String(year), weekNumber: String(weekNumber) } })`.

Import `WeekScoresEntry` from `@shared/types/cfb-pickem-api.js`.

---

## 2. `LeaderboardSection.tsx` — Add Toggle and Week View

### State additions
```
view: 'season' | 'week'  (default: 'season')
weekYear: number          (default: getCurrentSeason())
weeks: AdminWeekData[]
weekNumber: number | null
weekEntries: WeekScoresEntry[]
weekLoading: boolean
weekError: string | null
```

### Layout
- Add MUI `Tabs` (matching Dashboard.tsx pattern) with two tabs: "Season" and "Week", rendered above the existing season year selector
- Season view content: unchanged
- Week view content: year selector + week selector (both `FormControl`/`Select`, same styling as season year selector) + results table

### Week view effects (both use the cancelled flag pattern from `useWeekGames.ts`)

**Effect 1** — load weeks when `weekYear` changes (only when `view === 'week'`):
- Call `getWeeksForYear(weekYear)` from `userRequests.ts`
- On success: set `weeks`, default `weekNumber` to the highest `weekNumber` in the list
- On failure: set `weekError`
- Return cleanup: `cancelled = true`

**Effect 2** — load scores when `weekYear` or `weekNumber` changes (only when `view === 'week'` and `weekNumber !== null`):
- Call `getWeekScores(weekYear, weekNumber)`
- On success: set `weekEntries` sorted by `correct` desc, then `incorrect` asc
- On failure: set `weekError`
- Return cleanup: `cancelled = true`

**Effect dependency**: both effects should also trigger when `view` switches to `'week'` (include `view` in dependency array or trigger via the default-week effect)

### Week table columns
`#` | Name | Correct | Incorrect | Pending | Total | `%`

- `%`: `entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) + '%' : '—'`
- Current user row highlighted with `backgroundColor: 'action.selected'` (same as season view)
- Empty state: same italic Typography as season view ("No results for this week yet.")
- Week selector disabled while `weekLoading`

### Imports to add
- `Tabs`, `Tab` from `@mui/material` (already used in `Dashboard.tsx`)
- `AdminWeekData` type (from `@shared/types/cfb-pickem-api.js` or userRequests)
- `getWeeksForYear` from `../../apis/userRequests`
- `getWeekScores` from `../../apis/leaderboardRequests`
- `WeekScoresEntry` from `@shared/types/cfb-pickem-api.js`

---

## 3. Tests

### `leaderboardRequests.test.ts`
Add a `getWeekScores` describe block mirroring the existing `getLeaderboard` tests:
- 200 success returns `{ success: true, data: WeekScoresEntry[] }`
- 4xx returns `{ success: false, error: '...' }`

### `LeaderboardSection.test.tsx`
Add tests:
- Default view renders season tab selected
- Clicking "Week" tab renders week selector
- Week scores load and render in the table (mock `getWeekScores` and `getWeeksForYear`)
- Error path for week scores fetch

---

## Reused Utilities

- `getWeeksForYear` — `packages/frontend/src/apis/userRequests.ts`
- `getCurrentSeason` — `packages/frontend/src/utils/weekCalculation.ts`
- Cancelled flag pattern — `packages/frontend/src/components/user/useWeekGames.ts` (lines 122–152)

---

## Verification

1. `pnpm build` — must pass
2. `pnpm test:frontend` — all tests pass
3. Manual: open leaderboard tab, toggle to Week, confirm year/week selectors appear and scores load; toggle back to Season, confirm no regression
