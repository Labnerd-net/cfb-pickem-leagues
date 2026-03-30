# Game Card Countdown Timer and Lock Warning — Implementation Plan

**Branch:** `claude/feature/game-card-countdown-lock-warning`

---

## Overview

This plan covers all new files to create, existing files to modify, the shared-tick architecture, the warning dialog, and the test suite. No backend changes are required.

---

## 1. Architectural Decisions

### 1.1 Shared tick interval — lifted to `useWeekGames`

`UserPicksGameCard` currently calls `getNow()` once at render time to derive `isLocked`. With a shared tick, the parent owns a `now: Date` piece of state and re-renders all cards on each tick. Each card receives `now` as a prop and uses it instead of calling `getNow()` internally for the lock check and the countdown calculation.

The tick lives in a new hook `useCountdownTick` (see §2.1). `useWeekGames` calls this hook and exposes `now` alongside everything it already returns. `WeekGameSection` passes `now` down through `UserPicksGamesList` to each `UserPicksGameCard`.

### 1.2 Adaptive tick interval

- Tick every **5 seconds** when the earliest unlocked game is more than 2 minutes away.
- Tick every **1 second** when within 2 minutes (drives the "Locks in X m Y s" display).
- No tick at all when `VITE_IGNORE_PICK_DEADLINE=true` or when all games are locked / have no `startTime`.

### 1.3 Warning dialog — owned by `WeekGameSection`

The dialog is a separate component (`LockWarningDialog`). `WeekGameSection` holds a single `warningDismissed` boolean in `useState` and drives whether the dialog is open. A `useEffect` in `WeekGameSection` watches `now`, `userPicks`, `savedPickIds`, and `games` to decide whether to open the dialog.

### 1.4 `VITE_IGNORE_PICK_DEADLINE` gate

All new behavior (countdown rendering, warning dialog evaluation) is gated behind `!ignoreDeadline`. This mirrors how `isLocked` already works in `UserPicksGameCard`.

---

## 2. New Files to Create

### 2.1 `src/utils/countdownFormat.ts`

Pure utility with no React dependency.

**Exports:**
- `LOCK_WARNING_THRESHOLD_MS: number` — `15 * 60 * 1000`
- `formatCountdown(msRemaining: number): string`
  - `>= 60 min` → "Locks in X h Y m" (omit hours if 0)
  - `1–59 min` → "Locks in X m" (or "Locks in X m Y s" when < 2 min)
  - `< 1 min` → "Locks in Y s"
  - `<= 0` → `""` (caller shows LOCKED instead)
- `isWarningThreshold(msRemaining: number): boolean` — `0 < msRemaining <= LOCK_WARNING_THRESHOLD_MS`
- `isRedThreshold(msRemaining: number): boolean` — `0 < msRemaining <= 60 * 60 * 1000`

### 2.2 `src/components/user/useCountdownTick.ts`

React hook. Owns the `setInterval` and returns the current `Date`.

**Signature:** `function useCountdownTick(games: AdminGameWire[]): Date`

**Logic:**
1. If `VITE_IGNORE_PICK_DEADLINE=true`, skip the interval and return `getNow()` as a static value.
2. Derive `earliestUnlockedMs`: milliseconds until the earliest unlocked game.
3. Set `intervalMs` to 1 000 when `earliestUnlockedMs <= 2 * 60 * 1000`, otherwise 5 000.
4. Use `useEffect` with `setInterval` / `clearInterval`. Callback calls `setNow(getNow())`.
5. The effect dependency array includes `intervalMs` so the interval re-registers when the game enters the 1-second window.
6. Clean up the interval on unmount.

### 2.3 `src/components/user/LockWarningDialog.tsx`

MUI Dialog component. All data received as props; no internal state.

**Props:**
```typescript
interface LockWarningDialogProps {
  open: boolean;
  unsavedCount: number;
  minutesUntilLock: number;
  onSubmit: () => void;
  onDismiss: () => void;
}
```

- `DialogTitle`: "Picks deadline approaching"
- `DialogContent`: "You have {unsavedCount} unsaved pick(s). The first game locks in {minutesUntilLock} minute(s)."
- `DialogActions`: **Submit Now** (calls `onSubmit`) and **Dismiss** (calls `onDismiss`)

Follow the `BroadcastDialog.tsx` MUI pattern already in the codebase.

---

## 3. Existing Files to Modify

### 3.1 `src/components/user/useWeekGames.ts`

1. Import and call `useCountdownTick`, passing `games` from `useWeekNavigation`.
2. Add `now: Date` to the return type and export it.

### 3.2 `src/components/user/WeekGameSection.tsx`

1. Destructure `now` from `useWeekGames()`.
2. Add local state: `warningOpen: boolean`, `warningDismissed: boolean`.
3. Add a `useEffect` that evaluates the warning trigger on each `now` change:
   - Gate: `!ignoreDeadline && !resultsMode && !warningDismissed && !warningOpen && games.length > 0`
   - Find earliest unlocked game's `startTime`; compute `msRemaining`
   - If `isWarningThreshold(msRemaining)` and at least one key in `userPicks` is not in `savedPickIds`, set `warningOpen(true)`
4. Add a `useEffect` that resets `warningDismissed` to `false` when `selectedWeek` or `selectedYear` changes.
5. Render `<LockWarningDialog>` alongside the existing `<Snackbar>`.
6. Pass `now` down to `<UserPicksGamesList>`.
7. Wire `onSubmit`: call `handleSubmit()` then `setWarningOpen(false)`.
8. Wire `onDismiss`: `setWarningOpen(false); setWarningDismissed(true)`.

### 3.3 `src/components/user/UserPicksGamesList.tsx`

1. Add `now: Date` to `UserPicksGamesListProps`.
2. Pass `now` to each `<UserPicksGameCard>`.

### 3.4 `src/components/user/UserPicksGameCard.tsx`

1. Add `now: Date` to `UserPicksGameCardProps`.
2. Replace `getNow()` in the `isLocked` derivation with the `now` prop.
3. Compute `countdown`:
   - `null` if `ignoreDeadline || isLocked || game.startTime === null`
   - Otherwise `formatCountdown(new Date(game.startTime).getTime() - now.getTime())` — if result is `""`, keep `null`
4. Compute `isRed = isRedThreshold(msRemaining)` (only when countdown is non-null).
5. Render countdown label in the left "game info" box beneath the start time:
   ```
   {countdown !== null && (
     <Typography variant="caption" sx={{ color: isRed ? 'error.main' : 'text.secondary', fontFamily: '"Work Sans", sans-serif', fontWeight: isRed ? 600 : 400 }}>
       {countdown}
     </Typography>
   )}
   ```
6. Apply conditional card border: when `isRed && !isLocked && countdown !== null`, use `error.main` as `borderColor`.

---

## 4. Tick Flow Summary

```
useWeekGames
  └── useCountdownTick(games)      ← owns setInterval, returns now: Date
        ├── every 5s when > 2 min out
        └── every 1s when ≤ 2 min out

WeekGameSection
  ├── receives now from useWeekGames
  ├── useEffect → warning trigger evaluation on each now
  └── now → UserPicksGamesList → UserPicksGameCard (pure render)
```

---

## 5. Warning Dialog Logic

Trigger conditions (all must be true):
1. `!ignoreDeadline`
2. `!resultsMode`
3. `!warningDismissed`
4. `!warningOpen`
5. `games.length > 0`
6. Earliest unlocked game's `msRemaining` satisfies `isWarningThreshold(msRemaining)`
7. At least one key in `userPicks` is **not** in `savedPickIds`

**Dismissed-once semantics:** `warningDismissed` is local `useState` initialized to `false`. It resets to `false` in a `useEffect` depending on `[selectedWeek, selectedYear]`.

**Submit from dialog:** Call `handleSubmit()` (already async in `usePickSubmit`), then `setWarningOpen(false)`. The success snackbar fires normally.

---

## 6. Test Files

### 6.1 New: `tests/unit/utils/countdownFormat.test.ts`

| Scenario | Input ms | Expected |
|---|---|---|
| 3 h 22 m | 12,120,000 | "Locks in 3 h 22 m" |
| Exactly 1 h | 3,600,000 | "Locks in 1 h 0 m" |
| 45 m | 2,700,000 | "Locks in 45 m" |
| 1 m 30 s (< 2 min) | 90,000 | "Locks in 1 m 30 s" |
| 45 s | 45,000 | "Locks in 45 s" |
| 0 / negative | 0 / -1 | "" |
| `isRedThreshold` 59 m 59 s | 3,599,000 | true |
| `isRedThreshold` 60 m | 3,600,000 | false |
| `isWarningThreshold` 14 m | 840,000 | true |
| `isWarningThreshold` 15 m (boundary) | 900,000 | true |
| `isWarningThreshold` 16 m | 960,000 | false |
| `isWarningThreshold` 0 | 0 | false |

### 6.2 Modify: `tests/unit/components/UserPicksGameCard.test.tsx`

1. Add `now` prop (a future date) to all existing `render` calls.
2. New `describe('countdown label')`:
   - Renders "Locks in X h Y m" when `startTime` is 2 h out.
   - Renders red countdown when `startTime` is 30 min out.
   - No countdown when `startTime` is null.
   - No countdown when game is locked.
   - No countdown when `VITE_IGNORE_PICK_DEADLINE=true`.
3. Test red card border when `isRed` is true.

### 6.3 Modify: `tests/unit/components/WeekGameSection.test.tsx`

New `describe('lock warning dialog')` using `vi.useFakeTimers()` (restore with `vi.useRealTimers()` in `afterEach`):

1. Dialog appears when game is within threshold and unsaved pick exists.
2. "Submit Now" calls `postUserPicks` and dialog closes.
3. Dismiss hides dialog and prevents reappear on next tick.
4. No dialog when all picks are saved.
5. No dialog when `VITE_IGNORE_PICK_DEADLINE=true`.

### 6.4 New: `tests/unit/components/LockWarningDialog.test.tsx`

1. Renders correct `unsavedCount` and `minutesUntilLock` text.
2. "Submit Now" calls `onSubmit`.
3. "Dismiss" calls `onDismiss`.
4. Not visible when `open={false}`.

---

## 7. Implementation Sequence

1. Create `src/utils/countdownFormat.ts`
2. Create `tests/unit/utils/countdownFormat.test.ts` — verify passing
3. Create `src/components/user/useCountdownTick.ts`
4. Create `src/components/user/LockWarningDialog.tsx`
5. Create `tests/unit/components/LockWarningDialog.test.tsx` — verify passing
6. Modify `src/components/user/UserPicksGameCard.tsx` — add `now` prop, countdown rendering
7. Modify `tests/unit/components/UserPicksGameCard.test.tsx` — add `now` prop to existing tests + new countdown cases
8. Modify `src/components/user/UserPicksGamesList.tsx` — thread `now` prop
9. Modify `src/components/user/useWeekGames.ts` — call `useCountdownTick`, expose `now`
10. Modify `src/components/user/WeekGameSection.tsx` — warning dialog state, effect, JSX, pass `now` down
11. Modify `tests/unit/components/WeekGameSection.test.tsx` — add lock warning dialog cases
12. Run `pnpm build` and fix any type errors
13. Manual smoke test using `devCurrentTime` to simulate a game within 10 minutes of start

---

## 8. Potential Pitfalls

- **`now` prop in card:** Replace `getNow()` fully — leaving any internal `getNow()` call in `UserPicksGameCard` would cause a stale lock state between ticks.
- **`intervalMs` change cleanup:** The `useCountdownTick` effect dependency array must include `intervalMs` so the old 5s interval is cleared when the game enters the 1s window.
- **`vi.useFakeTimers()` in tests:** Wrap `vi.advanceTimersByTime()` inside `act()`. Call `vi.useRealTimers()` in `afterEach` to prevent leaking.
- **`warningDismissed` reset timing:** The reset effect must depend on `[selectedWeek, selectedYear]` — these change when the user navigates between weeks, re-arming the dialog for the new week.
