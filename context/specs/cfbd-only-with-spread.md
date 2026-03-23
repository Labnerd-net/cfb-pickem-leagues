# Spec for CFBD-Only Data Source with Spread Support

Title: CFBD-Only Data Source with Spread Support
Branch: claude/feature/cfbd-only-with-spread
Spec file: context/specs/cfbd-only-with-spread.md

## Summary

Remove the NCAA API data source entirely, making CFBD the sole data provider. Since CFBD is now the only source, `CFBD_API_KEY` becomes unconditionally required, `DATA_SOURCE` env var is removed, and the `ncaa-api.ts` adapter is deleted. This also unblocks adding point spread data to games, since CFBD exposes a lines API that the NCAA API does not.

Additionally, add a `spread` field (home team perspective, e.g. `-3.5` means home team is favored by 3.5) to the `admin.games` table and surface it in the admin game management UI. The spread is fetched from CFBD's lines endpoint at the same time game data is fetched.

## Functional Requirements

### Remove NCAA API
- Delete `packages/backend/src/api/ncaa-api.ts`
- Remove the `ncaa` branch from `packages/backend/src/api/index.ts` — only the CFBD path remains
- Remove the `DATA_SOURCE` env var from `envVars.ts`; remove the `ncaa`/`cfbd` enum and the `superRefine` cross-field check
- `CFBD_API_KEY` becomes a required env var unconditionally (no conditional check)
- Remove `ncaaGameId` column from `admin.games` schema and all references (shared types, DB functions, converters)
- Remove `ncaaGameId` from `AdminGameData`, `AdminDbGameData`, `UserGameData`, `UserDbGameData` shared interfaces
- Remove `DataSource` type from shared types if no longer needed
- Generate and apply a Drizzle migration for column removal

### Add Spread Field
- Add a nullable `spread` column (`real` / float) to `admin.games` — represents home team spread (negative = home favored, positive = home underdog)
- Add `spread: number | null` to `AdminGameData` and `AdminDbGameData` shared interfaces
- Fetch spread data from CFBD lines endpoint (`getLines`) when fetching game data in `cfbd.ts`; match lines to games by CFBD game ID; prefer consensus line, fall back to first available line if no consensus
- Populate `spread` in the `getGameData` converter in `api/index.ts`
- Add `spread` column to Drizzle schema; generate and apply migration
- Expose `spread` in all DB query functions that return game data (`returnGames`, `returnPickedGames`, `returnGame`, `returnGamesBulk`, etc.)
- Display spread in the admin game card/list in the frontend (read-only; not user-editable)

### CLAUDE.md / Docs Updates
- Update `CLAUDE.md` env var table: remove `DATA_SOURCE`, change `CFBD_API_KEY` comment to required (no conditional)

## Possible Edge Cases

- **Existing `ncaaGameId` data**: Any rows in production with a non-null `ncaaGameId` will have the column dropped. The column should be dropped with a standard `ALTER TABLE DROP COLUMN` — no data migration needed since CFBD games never had this populated.
- **No lines available**: Many games (especially early-week or lower-profile matchups) will have no CFBD lines entry. `spread` must be nullable and the UI must handle `null` gracefully (show nothing or "N/A").
- **Multiple lines from different providers**: CFBD returns multiple line entries per game (ESPN BET, DraftKings, etc.). Prefer the consensus line; if absent, use the first available. If the array is empty, `spread` is `null`.
- **Postseason spread**: Bowl games and playoff games typically have spreads; they should work the same as regular season.
- **Rate limiting / second API call**: Fetching lines requires a second CFBD API call per week fetch. Should be done in parallel with the game fetch where possible.
- **`DATA_SOURCE` still in existing `.env` files**: Removing the env var won't break startup since extra env vars are ignored by the Zod schema; it's a no-op. CLAUDE.md should note it's deprecated.

## Acceptance Criteria

- `DATA_SOURCE` env var is no longer read or validated by the backend
- `CFBD_API_KEY` missing causes a startup fatal error regardless of other config
- `ncaaGameId` column no longer exists in the database schema
- `ncaaGameId` is removed from all TypeScript types and DB query return values
- `ncaa-api.ts` is deleted; no remaining imports reference it
- `admin.games` has a nullable `spread` column (real/float)
- `AdminGameData` includes `spread: number | null`
- Spread is fetched from CFBD lines and stored when syncing game data
- Admin game display shows spread when available, blank/N/A when null
- `pnpm build` passes with no errors
- Existing tests pass; new tests cover spread fetch/mapping and null spread handling

## Open Questions

- Should spread be shown to regular users on their picks view, or only visible to admins? (Current assumption: admin-only display, users see the game without a point spread.) - admin only for now.
- Should we store the spread provider name (e.g. "consensus", "DraftKings") alongside the spread value, or just the number? (Current assumption: just the number.) - I guess just the number

## Testing Guidelines

Create or update test files in `packages/backend/tests/` and `packages/frontend/tests/` for:

- **`cfbd.ts` lines fetch**: mock CFBD `getLines` response; verify consensus line is preferred over non-consensus; verify null when no lines returned
- **`api/index.ts` converter**: verify `spread` is correctly mapped from CFBD lines onto `AdminGameData`; verify null spread when lines array is empty
- **`envVars.ts`**: verify startup throws when `CFBD_API_KEY` is missing (no `DATA_SOURCE` conditional needed)
- **DB schema**: no tests needed for column removal, covered by migration

## Personal Opinion

This is a good change. The NCAA API was already dead code — no active installs were using it, and it couldn't support postseason games properly. Removing it simplifies the adapter layer significantly and removes a whole class of conditional branching.

The spread addition is a natural, low-risk extension: it's a single nullable column with a one-time fetch alongside existing game data. The only risk is the second API call per sync — fetching lines in parallel with games mitigates that.

One concern: the `ncaaGameId` column drop is an irreversible migration. If there's a live production instance with data from the NCAA source, those game records will lose their external ID link. Since CFBD games were never populated with `ncaaGameId`, this only matters if the NCAA source was ever used in production. Worth confirming before running the migration.

Overall complexity is low to moderate: schema migration, one deleted file, one simplified adapter, one new nullable column. No behavioral changes to picks, scoring, or auth.
