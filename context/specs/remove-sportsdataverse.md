# Spec for Remove SportsDataverse

Title: Remove SportsDataverse Data Source
Branch: claude/feature/remove-sportsdataverse
Spec file: context/specs/remove-sportsdataverse.md

## Summary

The app currently supports three external data sources: `ncaa`, `cfbd`, and `sdv` (SportsDataverse). We want to drop the `sdv` option entirely and only support `ncaa` and `cfbd` going forward. This involves removing the `sdv` adapter file, its type definitions, the `sportsdataverse` npm package, and all references to `sdv` in the codebase.

## Functional Requirements

- Remove `packages/backend/src/api/sdv.ts` entirely.
- Remove `packages/backend/src/types/sportsdataverse.d.ts` entirely.
- Remove the `sportsdataverse` npm package from `packages/backend/package.json` and the lockfile.
- Remove the `sdv` comment line in `envVars.ts` that references the SportsDataverse URL.
- The `DATA_SOURCE` env var validation should only accept `ncaa` or `cfbd`. If `DATA_SOURCE=sdv` is set, the server should fail fast with a clear error message.
- Update `CLAUDE.md` and any other docs that list `sdv` as a valid `DATA_SOURCE` option.
- The `api/index.ts` converter functions currently have no `else` branch for `sdv` — verify there are no silent fallthrough paths that referenced SDV.

## Possible Edge Cases

- Existing deployments may have `DATA_SOURCE=sdv` set in their environment. The fail-fast validation ensures they get a clear error rather than silently falling back to `ncaa`.
- The `sportsdataverse` package may have transitive dependencies in the lockfile that need cleaning up after removal.

## Acceptance Criteria

- `packages/backend/src/api/sdv.ts` no longer exists.
- `packages/backend/src/types/sportsdataverse.d.ts` no longer exists.
- `sportsdataverse` does not appear in `packages/backend/package.json`.
- `pnpm install` removes the package from the lockfile.
- Setting `DATA_SOURCE=sdv` causes the server to throw a clear fatal error on startup.
- Setting `DATA_SOURCE=ncaa` or `DATA_SOURCE=cfbd` continues to work as before.
- `pnpm build` passes with no errors.
- No remaining references to `sdv` or `sportsdataverse` exist in source files.

## Open Questions

- None — scope is clear.

## Testing Guidelines

No new unit tests are needed for a pure removal. Verify by:
- Confirming `pnpm build` passes.
- Confirming no TypeScript errors related to the removed types.
- Manual check: grep for `sdv` and `sportsdataverse` in `src/` should return no results.

## Personal Opinion

This is a straightforward cleanup with no meaningful downside. SportsDataverse was never exposed in production as a supported option — the `api/index.ts` converters had no `sdv` branch, meaning it was effectively dead code already. Removing it shrinks the dependency surface, simplifies `envVars.ts`, and removes a confusing third option that wasn't wired up. Low risk, low complexity, high clarity gain. Worth doing.
