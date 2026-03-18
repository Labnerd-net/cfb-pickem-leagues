# Spec for Error Boundary Hookup and Dead Code Removal

Title: Error Boundary Hookup and Dead Code Removal
Branch: claude/fix/error-boundary-and-dead-code-removal
Spec file: context/specs/error-boundary-and-dead-code-removal.md

## Summary

Two small fixes addressing an unused frontend component and a dead backend function:

1. **[13]** `ErrorBoundary.tsx` exists but is never rendered in `App.tsx`. Any uncaught render error crashes the whole app silently instead of showing a fallback. Wire it up to catch errors from any route component.
2. **[14]** `addGameToWeek` in `dbAdminFunctions.ts` appears to be unreachable — all routes and the cron job call `upsertGameForWeek` instead. Verify no callers exist, then remove it to reduce dead code and confusion.

## Functional Requirements

- `<ErrorBoundary>` must wrap the routing/provider tree in `App.tsx` so render errors in any child component are caught and display a fallback UI instead of a blank screen.
- The existing `ErrorBoundary` component implementation should not be changed unless a defect is found while wiring it up.
- `addGameToWeek` in `dbAdminFunctions.ts` must be confirmed as having zero callers (routes, cron, tests) before removal.
- If `addGameToWeek` has no callers, delete the function entirely — do not just comment it out.
- No new behavior should be introduced beyond the above two fixes.

## Possible Edge Cases

- `ErrorBoundary` may need to be placed outside `AuthProvider` if `AuthProvider` can itself throw — verify the component tree order.
- If `addGameToWeek` is referenced in any test file or script, it must not be deleted until those references are also removed or updated.

## Acceptance Criteria

- A thrown error inside a route component is caught by `ErrorBoundary` and displays its fallback UI; the rest of the app does not crash.
- `addGameToWeek` is absent from the codebase with no remaining references.
- `pnpm build` passes with no errors or TypeScript complaints.

## Open Questions

- None.

## Testing Guidelines

- No new test files needed for this change — it's a hookup and a deletion.
- Verify via manual browser test that intentionally throwing in a route component shows the ErrorBoundary fallback.
- Confirm via grep/search that `addGameToWeek` has zero remaining references after removal.

## Personal Opinion

Both fixes are straightforward and clearly correct. The `ErrorBoundary` hookup is a real bug — unhandled render errors produce a blank page with no user feedback, which is worse than showing an error message. The dead code removal is low-risk: `upsertGameForWeek` clearly supersedes `addGameToWeek`, and removing it prevents future confusion about which function to call.

Neither fix is complex. This is a good, safe cleanup item.
