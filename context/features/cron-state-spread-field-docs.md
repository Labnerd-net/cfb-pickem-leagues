# Plan: Cron State and Spread Field Documentation

## Context

Two backlog items (#13 and #17) flag undocumented assumptions that could mislead a future maintainer:

- **#13**: `cronTick.ts` holds per-week deduplication state in module-level variables. On restart these reset, but without a comment, the pattern looks fragile when it isn't — `hasNotificationBeenSent` in `dispatcher.ts` provides a DB-level safety net.
- **#17**: The `spread` column is populated from CFBD lines data but has no downstream use. Without a comment it looks like dead code eligible for removal.

Both fixes are comment-only. No behavior changes, no migrations, no tests.

---

## Changes

### 1. `packages/backend/src/cron/cronTick.ts` — lines 16–21

Replace the existing bare comment `// Module-level cron state (resets on process restart)` with a fuller block comment explaining:
- State resets on server restart (by design — no persistence needed)
- The only observable side effect is extra CFBD API calls on restart mid-week (`lastRefreshAt` reset triggers immediate refresh)
- User-facing safety net: `hasNotificationBeenSent()` in `dispatcher.ts` deduplicates at the DB level, so notifications are never double-sent regardless of in-memory state

### 2. `packages/backend/src/db/schema/admin.ts` — line 60

Add an inline `//` comment to the `spread` field:

```ts
spread: real('spread'), // populated from CFBD lines; reserved for future "against the spread" mode — not used in current scoring or pick display
```

Use an inline code comment (not Drizzle `.comment()`), since the latter would generate a pointless migration.

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/backend/src/cron/cronTick.ts` | Expand comment block at lines 16–21 |
| `packages/backend/src/db/schema/admin.ts` | Add inline comment on `spread` at line 60 |

---

## Verification

- `pnpm build` — must pass with no errors
- No tests to add or update
