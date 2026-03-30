# Plan: UsersSection and useWeekGames Refactor

## Key Decisions

**Where does `games` state live?** In `useWeekNavigation`. The games fetch is triggered by `selectedYear`/`selectedWeek` — navigation state that hook already owns. `usePickSubmit` only reads game IDs when building the submit payload and never drives a fetch itself. `useWeekNavigation` returns `games`; the composition hook passes it down to `usePickSubmit`.

**Where do `resultsMode` and `resultRows` live?** In `useWeekGames` (the composition hook). Both are derived from `games` (navigation) and `userPicks` (pick submit) together — neither sub-hook has both inputs. Compute them inline in the composition hook after calling both sub-hooks.

**`downloadCsv` utility shape:** Accept a pre-built CSV string and filename — `downloadCsv(csv: string, filename: string): void`. Maximally reusable, zero knowledge of data shape. The CSV string construction stays in `UsersSection.handleExport`.

---

## Files to Create/Modify

### 1. CREATE `packages/frontend/src/lib/exportCsv.ts`
- Export a single `downloadCsv(csv: string, filename: string): void` function.
- Creates a Blob, calls `URL.createObjectURL`, synthesizes and clicks an anchor, calls `URL.revokeObjectURL`.
- No React dependency.

### 2. CREATE `packages/frontend/src/components/admin/BroadcastDialog.tsx`
- Props: `open: boolean`, `onClose: () => void`.
- All internal state: `broadcastSubject`, `broadcastMessage`, `overrideEmailPrefs`, `sending`, `broadcastError`, `broadcastSuccess`.
- All handlers: `handleBroadcastClose` (includes `if (sending) return` guard + field reset), `handleBroadcastSend`, `broadcastFormValid` derived value.
- The entire `<Dialog>...</Dialog>` JSX block from `UsersSection` moves here verbatim.

### 3. MODIFY `packages/frontend/src/components/admin/UsersSection.tsx`
- Remove 7 broadcast `useState` declarations.
- Remove `handleBroadcastClose`, `handleBroadcastSend`, `broadcastFormValid`.
- Remove the `<Dialog>` block from JSX; replace with `<BroadcastDialog open={broadcastOpen} onClose={() => setBroadcastOpen(false)} />`.
- Keep `broadcastOpen` state (controls dialog visibility from the button).
- In `handleExport`: remove the blob/anchor/revoke block; replace with `downloadCsv(csv, filename)`. CSV string construction stays here.
- Remove `sendAdminBroadcast` import from `adminRequests`.
- Remove dialog-only MUI imports: `Dialog`, `DialogActions`, `DialogContent`, `DialogTitle`, `FormControlLabel`, `Checkbox`, `TextField`. Keep `CircularProgress` (still used in table and export button).
- Add imports for `BroadcastDialog` and `downloadCsv`.

### 4. CREATE `packages/frontend/src/components/user/useWeekNavigation.ts`
Return shape: `{ selectedYear, setSelectedYear, selectedWeek, setSelectedWeek, availableYears, weeks, games, loading, initializing, error }`.

Contains:
- All state: `selectedYear`, `selectedWeek`, `availableYears`, `weeks`, `games`, `loading`, `initializing`, `error`.
- Initialization effect (no deps): fetches prev/current/next season weeks, sets `availableYears`, defaults `selectedYear`/`selectedWeek`/`weeks` via `getCurrentWeek`.
- Year-change effect (deps: `[selectedYear, initializing]`, `cancelled` flag): re-fetches weeks, resets `selectedWeek` to first week. Skip guard `if (selectedYear === 0 || initializing) return` preserved.
- Games fetch effect (deps: `[selectedYear, selectedWeek]`, `cancelled` flag): fetches `getPickedGames`, sets `games`/`loading`/`error`. Skip guard `if (selectedYear === 0 || selectedWeek === 0) return` preserved. **Only the games half** — picks are handled separately.

### 5. CREATE `packages/frontend/src/components/user/usePickSubmit.ts`
Parameters: `{ selectedYear: number, selectedWeek: number, games: AdminGameWire[] }`.

Return shape: `{ userPicks, savedPickIds, submitting, snackbar, handlePickChange, handleSubmit, handleSnackbarClose }`.

Contains:
- All state: `userPicks`, `savedPickIds`, `submitting`, `snackbar`.
- Picks fetch effect (deps: `[selectedYear, selectedWeek]`, `cancelled` flag): fetches `getUserPicks`, builds `picksMap`/`savedIds`. Skip guard `if (selectedYear === 0 || selectedWeek === 0) return` preserved.
- `handlePickChange`, `handleSubmit`, `handleSnackbarClose` moved verbatim.

### 6. MODIFY `packages/frontend/src/components/user/useWeekGames.ts`
Becomes a thin composition hook. `UseWeekGamesReturn` interface and function signature unchanged.

Body:
1. Call `useWeekNavigation()`, destructure.
2. Call `usePickSubmit({ selectedYear, selectedWeek, games })`, destructure.
3. Derive `resultsMode = isResultsMode(games)` inline.
4. Derive `resultRows` inline (map over `games`, look up `userPicks`).
5. Return merged object matching `UseWeekGamesReturn` exactly.

Remove all state, effects, and handler functions (now in sub-hooks). Keep `SnackbarState` interface export if used externally, otherwise move to `usePickSubmit`.

---

## Gotchas

- **`cancelled` flag pattern** — must be preserved exactly in all three effects (year-change, games fetch, picks fetch). Do not simplify.
- **MUI import audit** — after removing dialog JSX from `UsersSection`, verify `CircularProgress` stays (used in export button and role toggle button).
- **`initializing` guard** — lives inside `useWeekNavigation` alongside the state it reads; no cross-hook dependency.
- **Duplicate fetch on navigation** — games and picks now fetch in separate effects in separate hooks, both keyed on `[selectedYear, selectedWeek]`. This is two concurrent requests instead of one batched `Promise.all`. Functionally identical; just be aware the timing is independent.
- **`SnackbarState` interface** — currently defined in `useWeekGames.ts`. Move to `usePickSubmit.ts` and re-export from `useWeekGames.ts` if any external file imports it, or just move it silently if not.
- **CSV filename** — generate in `UsersSection.handleExport` (not in the utility): `` `users-export-${new Date().toISOString().slice(0, 10)}.csv` ``.
