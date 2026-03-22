# Plan: Remove SportsDataverse Data Source

## Context

The app supports three external data sources (`ncaa`, `cfbd`, `sdv`). The `sdv` (SportsDataverse) option was never wired into the actual data converters in `api/index.ts` — both `getWeekData` and `getGameData` only have `cfbd` and `ncaa` branches, making `sdv` dead code. We're dropping it entirely to simplify the codebase and reduce the dependency surface.

## Files to Delete

- `packages/backend/src/api/sdv.ts` — the entire SDV adapter
- `packages/backend/src/types/sportsdataverse.d.ts` — type definitions for the removed package

## Files to Modify

### `packages/backend/package.json`
- Remove the `"sportsdataverse": "^2.0.0"` entry from `dependencies`.

### `packages/backend/src/utils/envVars.ts`
- Remove the `// sdv = sportsdataverse = ...` comment line (line 34).
- Add a fail-fast validation block after `dataSource` is declared: if `DATA_SOURCE` is set to anything other than `ncaa` or `cfbd`, throw a `FATAL` error — same pattern as the existing JWT and CFBD key checks.

### `CLAUDE.md`
- Line 150: change `DATA_SOURCE=ncaa  # or cfbd, sdv` → `DATA_SOURCE=ncaa  # or cfbd`

## Steps

1. Delete `packages/backend/src/api/sdv.ts`.
2. Delete `packages/backend/src/types/sportsdataverse.d.ts`.
3. Remove `sportsdataverse` from `packages/backend/package.json` dependencies.
4. In `envVars.ts`: remove the sdv comment; add validation that throws if `dataSource` is not `'ncaa'` or `'cfbd'`.
5. Update `CLAUDE.md` comment on `DATA_SOURCE`.
6. Run `pnpm install` from the repo root to remove the package from the lockfile.
7. Run `pnpm build` and verify no errors.

## Verification

- `grep -r "sdv\|sportsdataverse" packages/backend/src` returns no results.
- `pnpm build` passes with no TypeScript or bundler errors.
- Starting the server with `DATA_SOURCE=sdv` throws a `FATAL` error at startup.
- Starting with `DATA_SOURCE=ncaa` (default) works normally.
