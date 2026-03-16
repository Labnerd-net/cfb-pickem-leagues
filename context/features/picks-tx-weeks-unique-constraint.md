# Plan: Picks Transaction Rollback and Weeks Unique Constraint

## Context

Two backlog bugs to address:

- **[9]** `POST /user/picks` inserts picks in a `for` loop with no DB transaction. A failure on any insert leaves partial picks committed, with no rollback.
- **[12]** Claimed: `admin.weeks` has no unique constraint on `(year, weekNumber)`. **Finding: already resolved.** Migration `0000_jazzy_sitwell.sql` contains `CONSTRAINT "weeks_year_week_number_pk" PRIMARY KEY("year","week_number")`. No schema change needed.

## Fix [12] — Close as Already Resolved

No code change. The primary key constraint on `admin.weeks(year, week_number)` already enforces uniqueness at the DB level. Mark as resolved in backlog.

## Fix [9] — Transaction Wrapping for Picks Insert

### Approach

Follow the existing `deleteUserWithAudit` pattern: keep transaction logic inside the DB layer, not the route handler.

Add a new batch function to `dbUserFunctions.ts` that wraps all inserts in a single `db.transaction()`. The route handler calls this one function instead of looping over `addPickedGame`.

The existing `addPickedGame` function is kept as-is (it's also called in tests directly).

### Critical Files

- `packages/backend/src/db/dbUserFunctions.ts` — add `addPickedGamesBatch`
- `packages/backend/src/routes/user.ts` — replace insert loop with `addPickedGamesBatch`
- `packages/backend/tests/unit/db/dbUserFunctions.test.ts` — add transaction rollback test
- `context/backlog.md` — mark [12] resolved

### Implementation Steps

**Step 1 — `dbUserFunctions.ts`: add `addPickedGamesBatch`**

```typescript
export async function addPickedGamesBatch(picks: UserGamePicks[], userId: string): Promise<void> {
  logger.debug({ count: picks.length, userId }, 'addPickedGamesBatch');
  try {
    const userIdNumber = Number(userId);
    await db.transaction(async tx => {
      for (const pick of picks) {
        await tx
          .insert(games)
          .values({
            userId: userIdNumber,
            gameId: pick.game,
            teamChosen: pick.pick,
          })
          .onConflictDoUpdate({
            target: [games.userId, games.gameId],
            set: { teamChosen: pick.pick },
          });
      }
    });
  } catch (e) {
    logger.error({ err: e }, 'addPickedGamesBatch failed');
    throw e;
  }
}
```

This mirrors the insert logic already in `addPickedGame` but skips the redundant `returnGame` fetch (validation already happened in the route handler before this call).

**Step 2 — `user.ts`: replace insert loop**

Replace:
```typescript
for (const pick of userPicks.games) {
  await dbUserFunctions.addPickedGame(pick, userIdString);
}
```

With:
```typescript
await dbUserFunctions.addPickedGamesBatch(userPicks.games, userIdString);
```

**Step 3 — Tests: `dbUserFunctions.test.ts`**

Add two test cases in a new `addPickedGamesBatch` describe block:

1. **Happy path**: submit 2 valid picks via `addPickedGamesBatch` → both rows present in DB.
2. **Rollback**: use a second pick with a FK constraint violation (non-existent `gameId`) → assert 0 rows exist in `user.games` after the error is thrown.

Test pattern follows existing: use `seedTestData()`, `createTestWeek()`, `createTestGame()`, raw SQL via `db.execute()` to verify DB state.

**Step 4 — Backlog update**

In `context/backlog.md`, mark [12] as resolved with a note.

## Verification

1. `pnpm build` — no TypeScript errors.
2. `pnpm test:backend` — existing picks tests still pass; new transaction tests pass.
3. Manual browser test: submit picks, confirm they save correctly.
