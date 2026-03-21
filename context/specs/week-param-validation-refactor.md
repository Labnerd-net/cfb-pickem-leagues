# Spec for Week Param Validation Refactor

Title: Week Param Validation Refactor
Branch: claude/fix/week-param-validation-refactor
Spec file: context/specs/week-param-validation-refactor.md

## Summary

Three backlog items ([22], [26], [32]) all cluster around the same area: query-parameter validation for week/year identifiers is done manually with `isNaN` guards scattered across `user.ts`, `leaderboard.ts`, and `admin.ts`, the query param is named `week` inconsistently with internal naming, and the query schemas don't live in `zValidate.ts` alongside every other schema in the project. This fix consolidates all three issues in one pass.

## Functional Requirements

- Add a `weekIdentifierQuerySchema` (and validator) to `zValidate.ts` that validates `year` and `weekNumber` as query params using the existing `yearSchema` and `weekSchema` primitives.
- Add a `yearQuerySchema` (and validator) for routes that only take a `year` query param.
- Remove all manual `isNaN` / range-check blocks for `year` and `week` across `user.ts`, `leaderboard.ts`, and `admin.ts`. Replace them with `zValidator('query', ...)` using the new schemas.
- Rename the query parameter from `?week=` to `?weekNumber=` across all backend routes that accept a week query param. Update corresponding frontend API calls in `userRequests.ts` and `adminRequests.ts` to pass `weekNumber` instead of `week`.
- All Zod schemas (including the new query schemas) must live in `zValidate.ts`. No inline `z.object(...)` definitions in route files.

## Possible Edge Cases

- The Hono RPC client derives its type contract from the route definitions. Renaming the query param on the backend will cause a TypeScript compile error on the frontend until the frontend calls are updated — this is intentional and acts as a refactor safety net.
- `leaderboard.ts` reads `?week=` as `weekNumber` locally but the public param is still `week`. After the rename, the internal variable name and the param name will match — no behavior change, just less confusion.
- The existing `weekIdentifierSchema` in `zValidate.ts` is for JSON **body** validation (used on POST/PATCH). The new `weekIdentifierQuerySchema` is for **query** params — both must coexist. Their field names should match (both use `weekNumber` and `year`).
- Some routes only accept `?year=` with no week (e.g. `GET /user/weeks`, `GET /admin/weeks`). These should use the `yearQuerySchema` validator, not the full week identifier schema.

## Acceptance Criteria

- No `isNaN`, `< 1900`, `> 2100`, `< 1`, `> 52` manual checks remain in any route file.
- All query-param schemas are exported from `zValidate.ts`.
- All backend routes that previously accepted `?week=` now accept `?weekNumber=`.
- All frontend API functions pass `weekNumber` (not `week`) in query objects.
- `pnpm build` passes with no TypeScript errors.
- Invalid query params (non-numeric, out-of-range) return a 400 with a descriptive error, same behavior as before.

## Open Questions

- Should the JSON body schemas (`weekIdentifierSchema`, `pickedGameRequestSchema`, `allUserPickedRequestSchema`) also rename their `week` field to `weekNumber`? Those touch the shared `WeekIdentifier` type and pick submission payloads — broader impact. **Recommend deferring** to a separate item to keep this PR focused on query params only.

## Testing Guidelines

- Update existing tests that pass `?week=` query params to use `?weekNumber=` and verify they still pass.
- Add test cases for out-of-range and non-numeric `year` and `weekNumber` query params — assert 400 response with a meaningful message.
- Verify routes that only take `?year=` still reject invalid years.

## Personal Opinion

This is a clean, low-risk consolidation. The three items are genuinely co-located — touching the same 4 files — so batching them is the right call. The rename from `week` to `weekNumber` is the most impactful change: it's a breaking API contract change, but since the only consumer is the Hono RPC frontend client, TypeScript will catch every missed update at compile time, making it safe.

One concern: if any external consumer (script, curl command, third-party integration) hits these endpoints with `?week=`, they'll silently break. At current scale this is very low risk, but worth a note in the commit message.

Overall: good idea, simple to execute, meaningful long-term payoff.
