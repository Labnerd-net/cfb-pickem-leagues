# Plan: Adaptive Week Game Section

## Context

`UserPicksSection` and `WeekResultsSection` are two separate dashboard cards that duplicate ~150 lines of identical initialization and data-fetching logic (fetch weeks for prev/current/next seasons, year/week selectors, load games + picks on selection change). The only real difference is what they render and what week they default to. Combining them into one adaptive component eliminates the duplication, makes the week selector coherent (one selector instead of two independent ones), and simplifies `UserSection`.

Decisions from the spec answers:
- **Mode trigger**: results mode when any game in the selected week has started (i.e. `startTime` has passed) or is completed. Picks mode otherwise.
- **Partial weeks**: show results view (with `Pending` badge via existing `WeekResultsGameRow`) when the picking deadline has passed.
- **Card title**: "Weekly Games"
- **Default week**: current week (same as `UserPicksSection` today, using `getCurrentWeek`)

---

## Files to Create

### `packages/frontend/src/components/user/WeekGameSection.tsx`
New merged component. Contains all state and effects from both deleted components, unified.

**State:**
- `selectedYear`, `selectedWeek`, `weeks` — identical to both existing components
- `games: AdminDbGameData[]` — the curated games for the week (same as `availableGames` in `UserPicksSection`)
- `userPicks: Map<number, 'home_team' | 'away_team'>` — from picks endpoint
- `savedPickIds: Set<number>` — tracks which picks are persisted
- `loading`, `initializing`, `snackbarOpen/Message/Severity`, `error`

**Mode determination (derived, not state):**
```
const isResultsMode = games.some(
  g => g.completed || (g.startTime !== null && new Date() >= new Date(g.startTime))
);
```
This is computed inline from `games` — no extra state, no effect.

**Initialization effect** — identical to `UserPicksSection`: fetch prev/current/next season weeks, call `getCurrentWeek`, set `selectedYear`/`selectedWeek`.

**Year-change effect** — identical to both: reload weeks for year, reset to first week of that year.

**Week-change effect** — calls `getPickedGames` + `getUserPicks` in parallel (same as both). Populates `games`, `userPicks`, `savedPickIds`.

**Render:**
- Always render `UserWeekSelector` at top
- Loading/empty states (same as today)
- If `isResultsMode`: render a column of `WeekResultsGameRow` components, building `WeekResultRow` from `games` + `userPicks` map (same logic as `WeekResultsSection`)
- If `!isResultsMode`: render `UserPicksGamesList` with `games`, `userPicks`, `savedPickIds`, `handlePickChange`, `handleSubmit` (same as `UserPicksSection`)
- Snackbar at bottom (picks mode only — no snackbar needed for results view)

**`handlePickChange` and `handleSubmit`** — copied verbatim from `UserPicksSection`.

---

## Files to Delete

- `packages/frontend/src/components/user/UserPicksSection.tsx`
- `packages/frontend/src/components/user/WeekResultsSection.tsx`

---

## Files to Modify

### `packages/frontend/src/components/user/UserSection.tsx`

**Current layout (3 cards):**
```
[Your Picks (WeekResultsSection)] [Leaderboard]
[This Week's Games (UserPicksSection) — span 2]
```

**New layout (2 cards):**
```
[Weekly Games (WeekGameSection) — span 2]
[Leaderboard — span 2]
```
OR keep it tighter:
```
[Weekly Games — span 2]
[Leaderboard]
```
Recommended: `Weekly Games` full-width (span 2), `Leaderboard` below at natural width. This is consistent with the current treatment of "This Week's Games" as a full-width card and gives the games section the most space. - we will try this initially.

Changes:
- Remove `WeekResultsSection` import
- Remove `UserPicksSection` import
- Add `WeekGameSection` import
- Replace the two `DashboardCard` wrappers with one:
  ```tsx
  <DashboardCard
    icon={<CalendarMonthIcon ... />}
    title="Weekly Games"
    accentColor="primary"
    gridColumn={{ xs: '1', md: 'span 2' }}
  >
    <WeekGameSection />
  </DashboardCard>
  ```
- Keep the Leaderboard card unchanged

---

## Files to Check (No Changes Expected)

These sub-components are reused as-is:
- `UserWeekSelector` — `packages/frontend/src/components/user/UserWeekSelector.tsx`
- `UserPicksGamesList` + `UserPicksGameCard` — `packages/frontend/src/components/user/UserPicksGamesList.tsx`, `UserPicksGameCard.tsx`
- `WeekResultsGameRow` (and its exported `WeekResultRow` type) — `packages/frontend/src/components/user/WeekResultsGameRow.tsx`

API functions reused (no changes):
- `getPickedGames`, `getUserPicks`, `postUserPicks`, `getWeeksForYear` — `packages/frontend/src/apis/userRequests.ts`

Utilities reused (no changes):
- `getCurrentWeek`, `getCurrentSeason` — `packages/frontend/src/utils/weekCalculation.ts`

---

## Testing

The existing test suite has no component rendering tests (no `@testing-library/react` setup). Rather than add that infrastructure for this task, extract the mode-determination logic into a small pure utility and test that.

### Extract utility function
In `packages/frontend/src/utils/weekCalculation.ts` (or a new `gameUtils.ts`), add:
```ts
export function isResultsMode(games: AdminDbGameData[]): boolean {
  return games.some(
    g => g.completed || (g.startTime !== null && new Date() >= new Date(g.startTime))
  );
}
```

### Test file: `packages/frontend/tests/unit/utils/weekGameMode.test.ts`
Test cases (using Vitest, no DOM required):
1. Returns `false` for empty games array (no games = picks mode)
2. Returns `false` when all games are in the future and not completed
3. Returns `true` when at least one game is `completed: true`
4. Returns `true` when at least one game has `startTime` in the past (game started, not yet complete)
5. Returns `false` when all games have `startTime` in the future and `completed: false`
6. Returns `true` for a mixed week where some games are complete and some have future start times

---

## Verification

1. `pnpm test:frontend` — all existing tests pass, new mode-determination tests pass
2. `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` — no type errors
3. Manual: start the dev server and confirm:
   - Current week shows pick radio buttons and submit
   - A past completed week shows result rows with Correct/Incorrect/Pending chips
   - Switching between weeks transitions the view correctly
   - Submitting picks works and shows snackbar
   - Leaderboard card is unaffected
