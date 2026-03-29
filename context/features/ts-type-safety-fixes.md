# Plan: TypeScript Type Safety Fixes (Backlog #11 + #12)

## Context

Two patterns in the codebase silently defeat TypeScript's compile-time checking:

1. `adminRequests.ts` uses `as unknown as SomeType` on every response body and error extraction. This means backend shape changes (renamed props, new required fields) produce no compile errors on the frontend. `userRequests.ts` already uses `InferResponseType<>` + a typed `extractError` helper — `adminRequests.ts` should match.

2. `api/index.ts` builds `AdminWeekData` and `AdminGameData` objects by casting an empty object and mutating it field-by-field (`{} as AdminXxx`). TypeScript cannot verify all required fields are present; adding a required field to these interfaces won't surface a compile error here. The `getGameData` converter also never assigns `gameId`, which is currently required in `AdminGameData` — a pre-existing gap the cast has been hiding.

## Changes

### 1. `packages/shared/types/cfb-pickem-api.ts`

- Make `gameId` optional in `AdminGameData`: `gameId?: number`
- Override it as required in `AdminDbGameData`: add explicit `gameId: number` (TypeScript allows narrowing optional → required in an extending interface)

This reflects the real semantics: `gameId` is DB-assigned on insert and is always present in DB-read results (`AdminDbGameData`) but absent when building a new game object from CFBD data.

### 2. `packages/backend/src/api/index.ts`

Replace both `{} as Xxx` mutation patterns with single object literals.

**`getWeekData`** — all 5 fields of `AdminWeekData` are assigned; refactor to:
```ts
const data: AdminWeekData = {
  weekNumber: week.seasonType === 'postseason' ? regularWeekCount + week.week : week.week,
  year: week.season,
  seasonType: week.seasonType,
  weekStart: week.startDate,
  weekEnd: week.endDate,
};
```

**`getGameData`** — 13 fields assigned, `gameId` omitted (now optional). Refactor to a single object literal covering all assigned fields; TypeScript will enforce completeness.

### 3. `packages/frontend/src/apis/adminRequests.ts`

**Step A — Add `extractError` helper** (identical to `userRequests.ts`):
```ts
async function extractError(res: { json(): Promise<unknown> }): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? 'Request failed';
  } catch {
    return 'Request failed';
  }
}
```
Replace all 11 inline `(await res.json()) as unknown as { error: string }` error extractions with `await extractError(res)`.

**Step B — Add `InferResponseType` aliases** for the 8 endpoints that return structured response bodies:
```ts
import type { InferResponseType } from 'hono/client';
type GetWeeksRPC           = InferResponseType<typeof client.api.admin.weeks.$get, 200>;
type GetGamesRPC           = InferResponseType<typeof client.api.admin.games.$get, 200>;
type GetUsersRPC           = InferResponseType<typeof client.api.admin.users.$get, 200>;
type UpdateUserRolesRPC    = InferResponseType<typeof client.api.admin.users[':id']['roles']['$patch'], 200>;
type MarkGameCompleteRPC   = InferResponseType<typeof client.api.admin.games.complete.$post, 200>;
type CorrectGameScoreRPC   = InferResponseType<typeof client.api.admin.games[':gameId']['score']['$patch'], 200>;
type GetNotificationLogsRPC = InferResponseType<typeof client.api.admin['notification-logs'].$get, 200>;
type GetAdminExportRPC     = InferResponseType<typeof client.api.admin.users.export.$get, 200>;
```

**Step C — Replace response body casts** — for each endpoint, type `body` as the RPC type and access properties directly. Where the function return type uses `AdminDbGameData` / `AdminDbWeekData` (which have `Date` fields that come back as strings over JSON), use a single `as SomeType` cast instead of `as unknown as SomeType`. This is a weaker cast but TypeScript still checks structural compatibility, unlike the double-cast which bypasses all checking.

Example (getWeeksForYear before → after):
```ts
// before
const body = await res.json();
return { success: true, data: body.weeks as unknown as AdminDbWeekData[] };

// after
const body = (await res.json()) as GetWeeksRPC;
return { success: true, data: body.weeks as AdminDbWeekData[] };
```

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/types/cfb-pickem-api.ts` | `gameId` optional in `AdminGameData`; required override in `AdminDbGameData` |
| `packages/backend/src/api/index.ts` | Replace both `{} as Xxx` patterns with typed object literals |
| `packages/frontend/src/apis/adminRequests.ts` | Add `extractError`; add `InferResponseType` aliases; replace all `as unknown as` casts |

## Verification

```bash
# Type-check both packages — should pass with zero errors
npx tsc --noEmit -p packages/backend/tsconfig.json
npx tsc --noEmit -p packages/frontend/tsconfig.app.json

# Full test suite
pnpm test

# Build
pnpm build
```
