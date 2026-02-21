# Spec for Idempotent Admin Games GET

branch: claude/feature/idempotent-admin-games-get

## Summary

`GET /admin/games` currently fetches from an external API and writes games to the database when none are found. GET requests should be idempotent — they must not produce side effects. This change splits the implicit fetch-and-store behavior into two explicit operations: a pure read (GET) and a deliberate import action (POST).

## Functional Requirements

- `GET /admin/games` must only read from the database and return whatever games exist for the requested week. It must never call the external API or write to the database.
- A new `POST /admin/games/import` endpoint (or equivalent explicit action route) must handle fetching games from the external API and storing them in the database for a given week.
- The same logic should apply to the week auto-load behavior currently inside `GET /admin/games` — if weeks are missing, that should also be triggered explicitly, not silently on a read.
- The admin UI must surface the import action so admins can trigger it intentionally (e.g. a "Import Games" button).
- If `GET /admin/games` returns an empty list, the frontend should communicate clearly that no games have been imported yet for that week, and prompt the admin to trigger the import.

## Possible Edge Cases

- Admin calls GET before any import has occurred — should return an empty list, not auto-populate.
- Import is triggered twice for the same week — the endpoint should be idempotent (no duplicate games inserted).
- External API returns no games for a given week — the import endpoint should return an informative response rather than silently succeeding with zero records written.
- Week records do not exist when import is triggered — the import action should handle seeding weeks as part of its own flow.
- Import fails partway through (external API error) — partial writes should not leave the DB in an inconsistent state.

## Acceptance Criteria

- `GET /admin/games` returns only data from the database; it never calls an external API.
- A POST endpoint exists to explicitly trigger the fetch-and-store operation for a given week.
- Calling `GET /admin/games` multiple times for the same week with no import performed always returns the same result (empty list).
- The import endpoint is idempotent: importing the same week twice does not create duplicate game records.
- The admin frontend shows a clear call-to-action to import games when none exist for a week.
- Existing admin flows for curating and displaying games continue to work after the refactor.

## Open Questions

- Should the import endpoint accept the same `?year=&week=` query params, or be a JSON body POST? - I think a json body post
- Should week seeding (auto-loading week records) remain implicit in the import action, or become its own separate endpoint? - create it's own endpoint too
- Should there be a way to re-import a week (refresh scores/metadata), or is import a one-time action per week? - yes, have a re-import available for refresh
- Does the admin UI need any feedback on import progress (loading state, success/failure toast)? - yes feedback would be good

## Testing Guidelines

Create test file(s) in the `./tests` folder for this feature and cover the following without going overboard:

- `GET /admin/games` returns an empty array when no games have been imported for a week (no external API call made).
- `GET /admin/games` returns stored games when they exist in the database.
- `POST /admin/games/import` (or equivalent) calls the external API and stores returned games.
- Calling the import endpoint twice for the same week does not duplicate games.
- The import endpoint returns a meaningful error when the external API fails.

## Personal Opinion

This is a straightforward and correct change — side-effectful GETs are a real debugging hazard and violate HTTP semantics. The scope is narrow: it's mostly a route split and a small frontend addition. Not complex, not trivial. The main risk is that existing admin workflows implicitly rely on the auto-fetch behavior (e.g. the admin just navigates to a week and games appear). Surfacing an explicit import step changes that UX, so the admin UI change needs to be clear enough that it does not feel like a regression. Overall: good idea, low risk, worth doing.
