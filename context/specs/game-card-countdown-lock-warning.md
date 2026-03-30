# Spec for Game Card Countdown Timer and Lock Warning

Title: Game Card Countdown Timer and Lock Warning
Branch: claude/feature/game-card-countdown-lock-warning
Spec file: context/specs/game-card-countdown-lock-warning.md

## Summary

Users currently have no advance warning that a game is about to lock — it silently transitions to a grey "LOCKED" chip. Two improvements:

1. **Countdown timer** — each unlocked `UserPicksGameCard` shows a "Locks in X h Y m" label. When under 1 hour it turns red. When under 1 minute it shows seconds.
2. **Unsaved picks warning dialog** — when the first game of the week is within a configurable threshold (15 minutes) of locking and the user has unsaved picks in local state (picked but not submitted), a warning dialog appears prompting them to submit before the deadline.

## Functional Requirements

- Each unlocked game card displays the time remaining until lock (e.g. "Locks in 3 h 22 m"). Cards already locked show the "LOCKED" chip as today.
- The countdown refreshes on a shared interval (lifted to parent — not per-card) to avoid N independent timers.
- When time remaining drops below 1 hour, the countdown label and/or card border turns red (`error.main`).
- When time remaining drops below 0, the card transitions to locked state without a page reload (the existing `isLocked` check already derives from `getNow()`, so the shared tick will cause the card to re-render as locked).
- The unsaved-picks warning dialog triggers when:
  - The first game of the week is within 15 minutes of its start time, AND
  - The user has local picks (picks in the `userPicks` map from `useWeekGames`) that have not been submitted (i.e., at least one `gameId` in `userPicks` is not in `savedPickIds`).
- The dialog presents a summary ("You have X unsaved pick(s). The first game locks in Y minutes.") with two actions: **Submit Now** (calls `handleSubmit`) and **Dismiss**.
- The dialog fires at most once per session per week — dismissing it should not re-trigger it on the next tick.
- If the user submits after the dialog appears, the dialog closes.
- The `VITE_IGNORE_PICK_DEADLINE` flag bypasses the lock state; when it is set, neither the countdown nor the warning dialog should appear (matches existing behavior).

## Possible Edge Cases

- Game has no `startTime` (null): no countdown shown, no lock transition — matches existing behavior.
- All games for the week are already locked when the user loads the page: no countdown timers needed; the warning dialog never triggers.
- User dismisses the dialog, then makes more picks: the dialog does not re-appear in the same session (dismissed flag is local state, not persisted).
- User's clock is significantly behind server time: the countdown could appear active after the backend has locked the game. The `isLocked` check on submit will catch this server-side; no special handling needed on the frontend.
- Multiple games with different start times: the countdown on each card is based on that card's own `startTime`; the warning dialog threshold is based on the earliest unlocked game's `startTime` only.
- Week changes (user navigates to a different week via the selector): reset the dialog dismissed flag so the warning can trigger again for the new week if applicable.

## Acceptance Criteria

- Each unlocked game card shows a countdown label ("Locks in X h Y m" or "Locks in X m Y s" when < 1 minute).
- Countdown text is `error.main` (red) when under 60 minutes.
- Countdown disappears and card transitions to locked state when time expires, without a page reload.
- The shared tick interval is implemented at the `WeekGameSection` or `UserPicksGamesList` level, not inside individual cards.
- The warning dialog appears when the first game is ≤ 15 minutes away and the user has unsaved picks.
- Submitting picks from the dialog closes it and shows the normal submit snackbar.
- Dismissing the dialog prevents it from reappearing in the same session (same week).
- When `VITE_IGNORE_PICK_DEADLINE=true`, no countdown or dialog appears.

## Open Questions

- What is the right warning threshold? 15 minutes is a reasonable default, but 30 minutes may be more user-friendly for mobile users. Open to changing this.
- Should the countdown use seconds (updating every second) or only minutes (updating every minute)? Seconds is more precise but more re-renders. Recommended: update every 5 seconds when > 2 minutes out, every second when ≤ 1 minute.

## Testing Guidelines

- Unit test the countdown formatting helper (h/m/s display, threshold transitions, null startTime).
- Unit test the unsaved-picks warning trigger logic: fires when threshold met + unsaved picks exist; does not fire when all picks saved; does not fire again after dismissed.
- Component test `UserPicksGameCard` renders the countdown label and applies red color below 60-minute threshold.
- Component test that the warning dialog appears and "Submit Now" calls `handleSubmit`.

## Personal Opinion

This is a solid UX improvement — the silent lock transition is a real usability issue. The countdown timer is straightforward. The warning dialog is simple enough to implement cleanly.

One concern: lifting the tick interval to a parent component is the right call, but it adds a `useState<Date>` + `useEffect` tick to `WeekGameSection` or a hook, which will re-render all game cards on each tick. With ~10 cards this is fine at 15 users. Worth using `useCallback`/`memo` carefully if render performance becomes noticeable.

The 15-minute default threshold for the warning dialog is somewhat arbitrary. If the threshold is too short, users who are actively picking will get surprised. If too long, it's annoying. Recommend making it a constant that's easy to adjust.

Complexity: low-medium. Mostly frontend-only, no backend changes, no migrations. The hardest part is the shared tick interval pattern and getting the dialog dismissed-once logic right.
