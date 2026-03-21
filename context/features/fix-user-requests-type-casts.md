# Plan: Fix Hono RPC Type Casts in userRequests

## Context

`userRequests.ts` uses `as unknown as SomeType` on every Hono RPC `res.json()` call. These casts bypass TypeScript's end-to-end type safety — the whole point of the Hono RPC client. This plan removes all casts by aligning the declared types with what the RPC client actually infers.

**Root causes:**
1. **Date serialization mismatch** — Hono v4 (`^4.11.7`) applies `JSONify<T>` when inferring response types, which transforms `Date` → `string`. Shared types like `UserDbGameData` and `AdminDbGameData` use `Date` for `createdAt`/`startTime`, so the inferred type differs from the declared type.
2. **Wrong frontend interface** — `GetWeeksResponse.data` declared `weeks: AdminDbWeekData[]` (includes `createdAt`) but the backend route types `weeks: AdminWeekData[]` (no `createdAt`).
3. **Unnecessary wrapping cast** — `getUserPickHistory` casts `{ history: UserPickHistoryEntry[] }` to `UserPickHistoryResponse` even though they're the same shape.
4. **Frontend-local type** — `BroadcastChannelInfo` is declared locally in `userRequests.ts` but belongs in shared types per the spec.
5. **Repeated error body pattern** — Every function duplicates `(await res.json()) as unknown as { error: string }` with no shared helper.

---

## Files to Modify

- `packages/frontend/src/apis/userRequests.ts` — primary target; all casts live here
- `packages/shared/types/cfb-pickem-api.ts` — add `BroadcastChannelInfo`; may need to verify `UserPickHistoryResponse` shape
- **No backend changes needed** — types are correct on the backend side

---

## Implementation Steps

### Step 1 — Add `BroadcastChannelInfo` to shared types

In `packages/shared/types/cfb-pickem-api.ts`, add after `NotificationLogEntry`:

```ts
export interface BroadcastChannelInfo {
  ntfy: { topicUrl: string } | null;
  telegram: { inviteUrl: string | null } | null;
  discord: { inviteUrl: string | null } | null;
}
```

This matches the backend's literal response from `/notifications/channels` and the existing local type in `userRequests.ts`.

---

### Step 2 — Add `InferResponseType` imports to `userRequests.ts`

Use Hono's `InferResponseType` utility (available since Hono v3) to derive correct wire-format types for endpoints that have date fields:

```ts
import type { InferResponseType } from 'hono/client';
```

Then derive types:
```ts
type UserPicksBody = InferResponseType<typeof client.api.user.picks.$get, 200>;
// Inferred: { picks: Array<{ ..., createdAt: string, startTime: string | null }> }

type AdminGamesBody = InferResponseType<typeof client.api.user.games.$get, 200>;
// Inferred: { pickedGames: Array<{ ..., createdAt: string, startTime: string | null }> }
```

---

### Step 3 — Fix `GetWeeksResponse` interface

Change:
```ts
data?: { weeks: AdminDbWeekData[] };
```
To:
```ts
data?: { weeks: AdminWeekData[] };
```

The backend route explicitly types `weeks: AdminWeekData[]` — the frontend was incorrectly claiming it received `AdminDbWeekData` (with `createdAt`).

---

### Step 4 — Update response interfaces that reference date-containing types

`UserGameResponse.data` currently declares `UserDbGameData[]`. Change to use the inferred type:
```ts
export interface UserGameResponse {
  success: boolean;
  data?: UserPicksBody['picks'];  // string dates, not Date
  error?: string;
}
```

`AdminGameResponse.data` currently declares `AdminDbGameData[]`. Change to:
```ts
export interface AdminGameResponse {
  success: boolean;
  data?: AdminGamesBody['pickedGames'];  // string dates, not Date
  error?: string;
}
```

> **Note:** If downstream components reference `UserDbGameData` or `AdminDbGameData` and rely on `Date` objects (e.g., for date arithmetic), those components must be updated to expect `string` (or parse to `Date` at the component level). Check `WeekGameSection.tsx` and `UserPicksGameCard.tsx` for usages.

---

### Step 5 — Remove trivially-correct casts

These two casts hide no real mismatch:

1. **`getUserPickHistory`**: `data as unknown as UserPickHistoryResponse`
   - Backend returns `{ history: UserPickHistoryEntry[] }` (no dates in `UserPickHistoryEntry`)
   - `UserPickHistoryResponse = { history: UserPickHistoryEntry[] }` — identical shape
   - Remove the cast entirely

2. **`getNotificationSettings`**: `(await res.json()) as unknown as NotificationSettings`
   - Backend returns `NotificationSettings` directly (no date fields)
   - Remove the cast entirely

---

### Step 6 — Fix `getBroadcastChannels` cast

Import `BroadcastChannelInfo` from shared types (instead of the local declaration). The Hono-inferred type for the channels endpoint structurally matches `BroadcastChannelInfo`, so the cast is unnecessary:

```ts
// Remove local BroadcastChannelInfo interface
// Add import from @shared
const data = await res.json();  // inferred type matches BroadcastChannelInfo
return { success: true, data };
```

---

### Step 7 — Consolidate error body handling

Every function has this identical block:
```ts
const body = (await res.json()) as unknown as { error: string };
return { success: false, error: body.error };
```

Create a module-level helper at the top of `userRequests.ts`:
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

Replace all 6+ error-path blocks with:
```ts
return { success: false, error: await extractError(res) };
```

This reduces the `as unknown` cast to a single documented location. Note: `as { error?: string }` on an `unknown` result is valid TypeScript (assigning unknown to a concrete type is always allowed).

---

### Step 8 — Verify downstream component types

After updating `UserGameResponse.data` and `AdminGameResponse.data`, check these files for type errors:
- `packages/frontend/src/components/user/WeekGameSection.tsx`
- `packages/frontend/src/components/user/UserPicksGameCard.tsx`

Look for any use of `.startTime`, `.createdAt` that performs `Date` operations. If found, add a `new Date(startTime)` conversion at the usage site — this makes the serialization boundary explicit rather than hiding it behind a cast.

---

## Verification

```bash
# Type-check frontend
npx tsc --noEmit -p packages/frontend/tsconfig.app.json

# Full build
pnpm build

# Frontend tests
pnpm test:frontend
```

No new tests needed — this is a type-only fix with no runtime behavior change.

---

## Cast removal summary

| Location | Old cast | Fix |
|---|---|---|
| All error paths (6×) | `as unknown as { error: string }` | `extractError()` helper |
| `getWeeksForYear` L48 | `as unknown as AdminDbWeekData[]` | Fix interface to `AdminWeekData[]` |
| `getUserPicks` L70 | `as unknown as UserDbGameData[]` | Use `UserPicksBody['picks']` |
| `getPickedGames` L92 | `as unknown as AdminDbGameData[]` | Use `AdminGamesBody['pickedGames']` |
| `getUserPickHistory` L112 | `as unknown as UserPickHistoryResponse` | Remove (types match) |
| `getNotificationSettings` L151 | `as unknown as NotificationSettings` | Remove (types match) |
| `getBroadcastChannels` L177 | `as unknown as BroadcastChannelInfo` | Remove (use shared type) |
