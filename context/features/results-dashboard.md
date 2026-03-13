# Plan: Week Results Section ("Your Picks" Card)

## Context

The "Your Picks" `DashboardCard` in `UserSection.tsx` currently renders "Coming soon...". The goal is to show the user their pick results for any selectable week — defaulting to the most recently completed week. For current/future weeks, games show both resolved and pending results. If the user made no picks for the selected week, all games still appear with a "No Pick" indicator.

---

## Data Flow

Two parallel fetches per week selection:
- `GET /user/games?year=&week=` → `AdminDbGameData[]` — all admin-curated games for the week
- `GET /user/picks?year=&week=` → `UserDbGameData[]` — user's picks (may be empty)

Merge by `gameId`: for each admin game, look up user pick. Result is `WeekResultRow[]` with optional `teamChosen` (null = no pick made).

Local interface (defined in `WeekResultsSection.tsx`):
```ts
interface WeekResultRow {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  winningTeam: Team;
  completed: boolean;
  teamChosen: Team | null;
}
```

---

## Files to Create

### 1. `packages/frontend/src/components/user/WeekResultsSection.tsx`

State: `selectedYear`, `selectedWeek`, `weeks`, `results: WeekResultRow[]`, `loading`, `error`, `initializing`.

**On mount**: load weeks for `currentYear - 1` and `currentYear` (same pattern as `UserPicksSection`), call `getMostRecentCompletedWeek(allWeeks)` for the default.

**On `[selectedYear]` change** (skip when 0): reload weeks via `getWeeksForYear`, reset week to most recently completed.

**On `[selectedYear, selectedWeek]` change** (skip when either is 0): parallel-fetch `getPickedGames` + `getUserPicks`, merge into `WeekResultRow[]`.

Render: `UserWeekSelector` + list of `WeekResultsGameRow` (or loading/error/empty states).

### 2. `packages/frontend/src/components/user/WeekResultsGameRow.tsx`

Props: `{ row: WeekResultRow }`. Renders a `Paper` with:
- Matchup: `{awayTeam} @ {homeTeam}`
- Score: "Final: ..." if `completed`
- Pick: team name, or italic "No pick made"
- Result `Chip`:
  - `teamChosen === null` → grey "No Pick"
  - `winningTeam === 'pending'` → grey "Pending"
  - `teamChosen === winningTeam` → green "Correct"
  - else → red "Incorrect"

### 3. `packages/frontend/tests/unit/components/WeekResultsSection.test.tsx`

Mock `getPickedGames`, `getUserPicks`, `getWeeksForYear` via `vi.mock`. Tests:
- Shows `CircularProgress` while initializing
- Renders result rows when data returned
- Shows "Correct" chip for correct pick
- Shows "Incorrect" chip for wrong pick
- Shows "Pending" chip when `winningTeam === 'pending'`
- Shows "No Pick" chip and italic text when `teamChosen` is null
- Shows empty state when no games returned
- Shows error state when fetch fails
- Re-fetches when week changes

---

## Files to Modify

### 4. `packages/frontend/src/utils/weekCalculation.ts`

Add `getMostRecentCompletedWeek(weeks: AdminDbWeekData[]): CurrentWeek`:
```ts
export function getMostRecentCompletedWeek(weeks: AdminDbWeekData[]): CurrentWeek {
  const now = new Date();
  const completed = weeks
    .filter(w => new Date(w.weekEnd) < now)
    .sort((a, b) => b.year - a.year || b.weekNumber - a.weekNumber);
  if (completed.length > 0)
    return { year: completed[0].year, week: completed[0].weekNumber };
  // No completed weeks yet — fall back to first available
  const sorted = [...weeks].sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);
  return sorted.length > 0
    ? { year: sorted[0].year, week: sorted[0].weekNumber }
    : { year: now.getFullYear(), week: 1 };
}
```

### 5. `packages/frontend/src/components/user/UserSection.tsx`

Replace the "Your Picks" card's "Coming soon..." `Typography` with `<WeekResultsSection />`.

---

## Key Patterns to Reuse

| Pattern | Source |
|---|---|
| Week initialization (mount + year change) | `UserPicksSection.tsx` |
| Year/week selector | `UserWeekSelector.tsx` |
| Loading / error / empty states | `UsersSection.tsx` |
| Game card layout (Paper, score display) | `UserPicksGameCard.tsx` |
| `getCurrentWeek` utility | `src/utils/weekCalculation.ts` |

---

## Verification

1. `pnpm dev:backend` + `pnpm dev:frontend`
2. Log in — "Your Picks" card defaults to most recently completed week with Correct/Incorrect badges
3. Change week — results reload
4. Select a week with no picks — games show with "No Pick" badge
5. Select an in-progress week — completed games show Correct/Incorrect, unfinished show Pending
6. `pnpm test:frontend` — all tests pass
7. `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` — no errors
