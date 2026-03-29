# Spec for TypeScript Type Safety Fixes

Title: TypeScript Type Safety Fixes
Branch: claude/fix/ts-type-safety-fixes
Spec file: context/specs/ts-type-safety-fixes.md

## Summary

Two TypeScript type-safety gaps that silently defeat compile-time checking:

1. **`adminRequests.ts` double-cast pattern** (backlog #11): ~15 occurrences of `as unknown as SomeType` bypass Hono's inferred response types. If a backend response shape changes, no compile error surfaces at these call sites. `userRequests.ts` already uses `InferResponseType<>` correctly — `adminRequests.ts` should match.

2. **`api/index.ts` empty object mutation** (backlog #12): Both `getWeekData` and `getGameData` use `{} as AdminWeekData` / `{} as AdminGameData` and then mutate the object field-by-field. TypeScript cannot check that all required fields are set, and adding a new required field to these interfaces won't produce a compile error at these sites.

## Functional Requirements

### Backlog #11 — adminRequests.ts

- Import `InferResponseType` from `hono/client`.
- Define `InferResponseType<>` aliases for each admin endpoint that returns structured data (weeks, games, users, notification logs, etc.).
- Replace all `as unknown as SomeType` casts on response bodies with these inferred types or with proper narrowing.
- Add a shared `extractError` helper to `adminRequests.ts` (mirroring `userRequests.ts`) and use it on every error path in place of the inline `as unknown as { error: string }` casts.
- Do not change function signatures or return types visible to callers — this is an internal type-safety improvement.

### Backlog #12 — api/index.ts

- Replace `{} as AdminWeekData` mutation in `getWeekData` with a proper object literal that includes all required fields in a single expression.
- Replace `{} as AdminGameData` mutation in `getGameData` with a proper object literal.
- **Note**: `AdminGameData.gameId` is a required field (`number`) but is never assigned in `getGameData` — the DB assigns it on insert. Before writing the object literal, confirm whether `gameId` should be made optional in `AdminGameData` (or handled via `Omit`), so the literal compiles without a cast. Adjust the shared type only if needed to reflect this intent accurately; do not widen it unnecessarily.

## Possible Edge Cases

- `InferResponseType` for admin endpoints that return `Date` fields (e.g., `createdAt`) will infer them as `string` over JSON — the same issue previously handled in `userRequests.ts`. Downstream consumers of these types may need `new Date(...)` wrapping where they use date values.
- If `AdminGameData.gameId` is made optional, check that all downstream consumers of the type that expect it to be defined are still satisfied (e.g., after DB insert returns the full row).

## Acceptance Criteria

- `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` passes with no new errors.
- `npx tsc --noEmit -p packages/backend/tsconfig.json` passes with no new errors.
- Zero `as unknown as` casts remain in `adminRequests.ts`.
- Zero `{} as AdminXxx` patterns remain in `api/index.ts`.
- All existing tests continue to pass (`pnpm test`).
- No functional behavior changes — this is a type-only fix.

## Open Questions

- Should `gameId` be `gameId?: number` in `AdminGameData`, or should the converter use `Omit<AdminGameData, 'gameId'>` for its return type? The former is simpler; the latter keeps the base type strict. Decide during plan/implementation. - use gameId?: number

## Testing Guidelines

No new tests needed — this is a pure TypeScript type-safety change with no runtime behavior difference. Verify via `tsc --noEmit` on both packages and the existing test suite.

## Personal Opinion

Both fixes are straightforward and clearly worth doing. The `adminRequests.ts` cast cleanup mirrors work already done in `userRequests.ts`, so the pattern is established — it's just repetitive application. The `api/index.ts` fix is similarly mechanical, with one wrinkle: `gameId` being required in `AdminGameData` but absent from the converter output. That's a legitimate pre-existing type bug the refactor will surface, and it needs a deliberate decision rather than a workaround cast. The `gameId?: number` approach is the simplest resolution given the DB assigns it on insert.

These two items fit naturally together in one branch since they're both TS type-safety cleanups with no behavior changes.
