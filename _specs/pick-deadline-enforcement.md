# Spec for Pick Deadline Enforcement

branch: claude/feature/pick-deadline-enforcement

## Summary

Currently nothing prevents a user from submitting or changing a pick after a game has already kicked off. The `adminGames` table has no `startTime` column, the shared `AdminGameData` type has no start time field, and the `POST /picks` endpoint performs no deadline check. This spec adds game start times end-to-end and enforces a pick deadline server-side.

## Functional Requirements

- Add a `startTime` (UTC timestamp) column to the `adminGames` DB table.
- Add `startTime` to the `AdminGameData` and `AdminDbGameData` shared types.
- Populate `startTime` when importing games from each external API adapter (NCAA, CFBD, SDV).
- The `POST /picks` endpoint must reject any pick for a game whose `startTime` is in the past (i.e. `now >= game.startTime`). Return a clear error response rather than silently accepting or ignoring the pick.
- If a request contains multiple picks and any one of them is past the deadline, reject the entire request with a descriptive error indicating which game(s) are locked.
- The frontend pick card for a game must show a locked/disabled state once past `startTime`, preventing interaction without relying on the server check alone.
- The frontend should display the game start time on each pick card so users know when the deadline is.

## Possible Edge Cases

- Games imported before this migration exist with no `startTime`. The column must be nullable so existing rows are not broken. The pick endpoint should treat a `null` `startTime` as "no deadline" and allow picks to proceed (or optionally block as unknown — needs a decision, see Open Questions).
- Clock skew between client and server: the server clock is authoritative. The frontend locking is UX-only and must not be relied upon for enforcement.
- A game's start time may be updated by the external API after initial import (postponements, weather delays). Re-importing games should overwrite `startTime` if the new value differs.
- A user might have a browser tab open past kickoff and try to submit stale picks. The server rejection handles this; the frontend should surface the error clearly.
- Timezone handling: all times stored and compared in UTC. Display to users in their local timezone via the browser.

## Acceptance Criteria

- `startTime` is present in the DB schema, shared types, and all three API adapters.
- A pick submitted before `startTime` is accepted.
- A pick submitted at or after `startTime` is rejected with an HTTP 4xx response and a human-readable error message.
- The frontend pick card is visually disabled and non-interactive once `now >= startTime`.
- The game start time is displayed on each pick card in the user's local timezone.
- All existing tests continue to pass.
- New tests cover: server-side acceptance before deadline, server-side rejection at/after deadline, and null `startTime` behaviour.

## Open Questions

- What should the server do if `startTime` is `null` (legacy game with no start time)? Allow picks (safer, backward compatible) or block (stricter)? Recommendation: allow, since blocking unknown games would break existing data. - block picks from null start times.  I will be reseting the existing data in the database anyway.  Can we have a debug env variable to where it ignores start time so I can test this app even though there is no season active?
- Should the deadline be exactly `startTime` or `startTime - N minutes` (e.g. a 5-minute buffer)? A buffer reduces race conditions where a user submits just as the game kicks off. Keep it simple for now: use exact `startTime`. - just use start time for now
- Should the error response list every locked game, or just the first one encountered? Listing all is more helpful but slightly more complex. - just the first one is fine.  you can also warn to check other games too.

## Testing Guidelines

Create test file(s) in the `./tests` folder for the new feature, and create meaningful tests for the following cases, without going too heavy:

- `POST /picks` accepts a pick when the current time is before `startTime`.
- `POST /picks` rejects a pick when the current time is at or after `startTime`, returning a 4xx with a message identifying the locked game.
- `POST /picks` allows a pick when `startTime` is `null` (legacy row).
- `POST /picks` with a mixed batch (some locked, some not) rejects the whole request.
- Frontend: pick card renders in a disabled/locked state when `startTime` is in the past.
- Frontend: pick card renders as interactive when `startTime` is in the future.

## Personal Opinion

This is a necessary correctness fix, not a nice-to-have. Accepting picks after kickoff undermines the entire game. It is well-scoped: one schema column, one type change, three adapter updates, one endpoint check, and a UI tweak. The risk is low and the implementation is straightforward.

The one thing to watch is the `null` start time decision for legacy data — pick a policy and document it, otherwise the behaviour will be ambiguous. Allowing picks when `startTime` is null is the safer default since blocking would break any game imported before this change is deployed.

Do not implement a client-side countdown timer or grace-period logic in this pass — keep it simple.
