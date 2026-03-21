# Plan: Admin and User Section Component Refactor

## Context

Backlog items [23] and [24]. Two large frontend components mix data-fetching logic with render logic, making them hard to read and test:
- `AdminSection.tsx` — 369 lines, 9 state vars, 7 async handlers, 2 useEffect hooks
- `WeekGameSection.tsx` — 305 lines, 10 state vars, 3 useEffect hooks, dual-mode render (picks vs results)

Goal: extract custom hooks and split render paths. Zero behavior changes.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/useWeekManagement.ts` | Hook for year/week selection and weeks data |
| `src/components/admin/useGameManagement.ts` | Hook for games data, selection, and import operations |
| `src/components/user/useWeekGames.ts` | Hook for all WeekGameSection data-fetching and picks logic |
| `src/components/user/WeekPicksView.tsx` | Sub-component: renders picks mode UI |
| `src/components/user/WeekResultsView.tsx` | Sub-component: renders results mode UI |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/AdminSection.tsx` | Replace inline state/effects/handlers with the two hooks |
| `src/components/user/WeekGameSection.tsx` | Replace inline state/effects/handlers with `useWeekGames`; delegate to `WeekPicksView`/`WeekResultsView` |

---

## Hook Designs

### `useWeekManagement(initialYear: number)`

State owned: `selectedYear`, `setSelectedYear`, `selectedWeek`, `setSelectedWeek`, `weeks`, `weeksChecked`, `loading`, `error`

Effect: fetches weeks via `getWeeksForYear(selectedYear)` when `selectedYear` changes. Sets `weeksChecked` after first fetch.

Exposes `importWeeks(setImportFeedback: Dispatch)` — calls `addWeeksToYear`, then reloads weeks, then calls the passed setter to report result. The `setImportFeedback` parameter lets `AdminSection` share the single `importFeedback` state owned by `useGameManagement`.

Returns: `{ selectedYear, setSelectedYear, selectedWeek, setSelectedWeek, weeks, weeksChecked, loading, error }`

### `useGameManagement(selectedYear: number, selectedWeek: number)`

State owned: `games`, `selectedGameIds`, `loading`, `importing`, `importFeedback`, `errorMessage`, `successMessage`

Effect: fetches games via `getGamesForWeek` when `selectedYear`/`selectedWeek` change. Pre-selects already-picked games.

Also exposes `loadGames()` as a callable function so it can be triggered imperatively after `handleSavePickedGames` (in addition to the effect).

Functions returned:
- `loadGames()` — fetch games for current year/week
- `handleSavePickedGames()` — calls `setPickedGames`, then `loadGames()`
- `handleImportGames()` — calls `addGamesToWeek`, reloads games, sets `importFeedback`
- `handleGameSelection(gameId, selected)`, `handleSelectAll()`, `handleDeselectAll()`
- `clearImportFeedback()` — lets AdminSection clear feedback on year/week change
- `clearMessages()` — clears errorMessage/successMessage (for snackbar close)

Returns: all state and handlers above.

### `useWeekGames()`

State owned: all 10 current state vars (`selectedYear`, `selectedWeek`, `weeks`, `games`, `userPicks`, `savedPickIds`, `loading`, `submitting`, `initializing`, `error`, snackbar state)

Effects:
1. Init effect (runs once): fetches prev/current/next season weeks in parallel, sets current week as default
2. Year-change effect: fetches weeks for new year, resets to first week
3. Week-change effect: parallel-fetches games + user picks; uses `cancelled` flag to prevent stale state

The `cancelled` flag pattern in effect 3 must be preserved exactly:
```ts
let cancelled = false;
// ...async work...
if (cancelled) return;
return () => { cancelled = true; };
```

Functions: `handlePickChange(gameId, pick)`, `handleSubmit()`, `handleSnackbarClose()`

Returns: all state and handlers needed by WeekGameSection.

---

## Sub-component Designs

### `WeekPicksView`
Props: `games: AdminGameWire[]`, `picks: Map<number, 'home_team' | 'away_team'>`, `savedPicks: Set<number>`, `onPickChange: (gameId, pick) => void`, `onSubmit: () => void`, `loading: boolean`

Renders: `<UserPicksGamesList>` — exact JSX lifted from current WeekGameSection picks branch.

### `WeekResultsView`
Props: `resultRows: WeekResultRow[]`

Renders: the `resultRows.map(row => <WeekResultsGameRow>)` list — exact JSX lifted from current WeekGameSection results branch.

---

## Refactored Component Shapes

### `AdminSection.tsx` after refactor (~100 lines)
```
const { selectedYear, setSelectedYear, selectedWeek, setSelectedWeek, weeks, weeksChecked, loading: weekLoading, ... } = useWeekManagement(getCurrentSeason())
const { games, selectedGameIds, loading, importing, importFeedback, ... } = useGameManagement(selectedYear, selectedWeek)

handleImportWeeks = () => weekHook.importWeeks(gameHook.setImportFeedback)

// JSX: WeekSelector + importFeedback alert + empty-weeks state + GamesList + Snackbars
```

### `WeekGameSection.tsx` after refactor (~80 lines)
```
const { selectedYear, selectedWeek, weeks, games, ..., resultsMode, resultRows, handlePickChange, handleSubmit, ... } = useWeekGames()

// JSX: UserWeekSelector + loading/error states + {resultsMode ? <WeekResultsView> : <WeekPicksView>} + Snackbar
```

---

## Testing

The existing `WeekGameSection.test.tsx` (391 lines, 20+ cases) mocks the API functions via `vi.mock()` — it tests through `WeekGameSection` as the entry point. After the refactor, since the component API (props, rendered output) is unchanged, **all existing tests should pass with no modification**.

Verify:
1. `pnpm test:frontend` — all existing tests pass
2. `pnpm build` — no type errors
3. Manual smoke test: load admin section, import games, save picks; load user section, make picks, switch weeks
