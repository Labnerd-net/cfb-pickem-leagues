# Spec for Cron State and Spread Field Documentation

Title: Cron State and Spread Field Documentation
Branch: claude/fix/cron-state-spread-field-docs
Spec file: context/specs/cron-state-spread-field-docs.md

## Summary

Two small documentation fixes to clarify intent and assumptions in areas that are otherwise easy to misread:

1. **Cron state in `cronTick.ts`** — Module-level in-memory state (`lastRefreshAt`, `hardCapStart`, `scoresCompletedForWeek`, `reminder24hSentForWeek`) resets on server restart. The existing `hasNotificationBeenSent` DB check prevents duplicate user notifications, so this is acceptable, but the assumption is not documented. A future maintainer could incorrectly try to fix a non-problem or inadvertently break the safety net.

2. **`spread` column in `admin.ts` schema** — The `spread` field is persisted and populated from CFBD lines data, but it has no downstream use (no scoring, no display on user-facing views). Without a comment, it looks like dead code. Add a schema-level comment documenting that it is reserved for a future "against the spread" pick mode.

## Functional Requirements

- Add a comment block in `cronTick.ts` near the module-level state variables explaining:
  - That state resets on restart
  - Why this is safe: the `hasNotificationBeenSent` DB check deduplicates notifications
  - The only observable side effect of a restart mid-week is potential extra CFBD API calls
- Add a Drizzle column comment (or inline code comment) on the `spread` field in `packages/backend/src/db/schema/admin.ts` explaining it is reserved for a future "against the spread" game mode and is not currently used in scoring or pick display

## Possible Edge Cases

- Drizzle's `.comment()` on a column generates a migration (ALTER COLUMN ... SET COMMENT). Verify whether adding a schema comment triggers a migration and decide if that's acceptable, or use an inline code comment instead to avoid a migration.

## Acceptance Criteria

- `cronTick.ts` has a visible comment near the state declarations explaining the restart-reset behavior and why the `hasNotificationBeenSent` check makes it safe
- `spread` in `admin.ts` has a comment (schema-level or inline) documenting its purpose and current non-use
- No behavior changes anywhere
- Build passes (`pnpm build`)

## Open Questions

- For the `spread` schema comment: use Drizzle's `.comment('...')` (generates a migration) or a plain inline `// ...` comment? Given the trivial nature of the change, an inline comment is likely preferable to avoid a migration.

## Testing Guidelines

No new tests needed — these are comment-only changes with no logic impact.

## Personal Opinion

Both are worthwhile. #13 is the more important of the two: without the comment, the module-level state looks like a subtle bug waiting to be "fixed" in a way that breaks the notification deduplication logic. #17 is minor but prevents `spread` from being incorrectly removed as dead code in a future cleanup. Neither change is complex — this is a quick PR.
