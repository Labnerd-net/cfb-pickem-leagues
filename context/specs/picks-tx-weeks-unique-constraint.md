# Spec for Picks Transaction Rollback and Weeks Unique Constraint

Title: Picks Transaction Rollback and Weeks Unique Constraint
Branch: claude/fix/picks-tx-weeks-unique-constraint
Spec file: context/specs/picks-tx-weeks-unique-constraint.md

## Summary

Two bug fixes in the backend targeting data-integrity gaps:

1. **[9] `POST /user/picks` lacks a transaction** — picks are inserted in a `for` loop with no wrapping transaction. If any insert fails mid-loop, the request partially commits: some picks are saved and others aren't, leaving the user's picks in an inconsistent state with no rollback.

2. **[12] `admin.weeks` unique constraint** — the backlog notes that `admin.weeks` has no unique constraint on `(year, weekNumber)`. However, reviewing the schema (`packages/backend/src/db/schema/admin.ts:35`) shows a `primaryKey({ columns: [table.year, table.weekNumber] })` is already defined, which PostgreSQL enforces as `NOT NULL + UNIQUE`. This item may be a false positive. The fix is to verify the constraint exists in the actual migration output and confirm weeks cannot be duplicated in practice.

## Functional Requirements

- `POST /user/picks`: All `addPickedGame` inserts must execute inside a single `db.transaction()`. If any insert fails, all picks for that request are rolled back — the database must not be left in a partial state.
- The transaction pattern should match the existing `deleteUserWithAudit()` pattern already used in `dbUserFunctions.ts`.
- For [12]: Inspect the generated migration SQL to confirm the primary key constraint on `admin.weeks(year, week_number)` is present. If it is, close the item as already resolved. If somehow it is missing (e.g. migration drift), add the constraint.

## Possible Edge Cases

- A DB connection drop mid-transaction should result in a full rollback (PostgreSQL default behavior with Drizzle transactions).
- If the pre-validation loop in `user.ts` throws before the insert loop starts, no DB writes happen — this path is already safe and should remain unchanged.
- Drizzle's `db.transaction()` callback receives a `tx` context that must be passed to all DB calls inside the transaction; care needed if `addPickedGame` currently uses the top-level `db` directly.

## Acceptance Criteria

- [ ] Submitting a batch of picks where one fails mid-way leaves zero picks committed for that request.
- [ ] A successful batch of picks is still fully committed as before.
- [ ] The `admin.weeks` primary key constraint is confirmed in the migration SQL.
- [ ] `pnpm build` passes with no errors.

## Open Questions

- Does `addPickedGame` in `dbUserFunctions.ts` use the module-level `db` directly? If so, the transaction context (`tx`) needs to be threaded through as a parameter or the function needs a second signature accepting an optional transaction object.
- Should [12] simply be closed after verifying the existing primary key, or should we add an explicit `unique()` constraint alongside the PK purely for documentation clarity? (Adding redundant constraints is harmless but noisy in migrations.)

## Testing Guidelines

Create or extend tests in `packages/backend/tests/`:

- **Transaction rollback**: mock or spy on `addPickedGame` to throw on the second call; assert no picks exist in the DB after the request resolves.
- **Transaction commit**: submit a valid batch of multiple picks; assert all picks are present in the DB.
- No frontend test changes needed for these fixes.

## Personal Opinion

Both fixes are straightforward and low risk.

[9] is a real bug worth fixing. The validation loop already prevents most bad inputs from reaching the insert loop, which hides the issue in normal usage — but a transient DB error or constraint violation on insert would still produce a partial commit. Using `db.transaction()` is the right fix and matches the existing pattern in `deleteUserWithAudit()`.

[12] looks like a false positive in the backlog audit. The schema already has a primary key on `(year, weekNumber)`, which is a stricter constraint than a standalone `unique()`. The fix is just a verification step. I'd recommend closing it after confirming the migration output rather than adding a redundant constraint.
