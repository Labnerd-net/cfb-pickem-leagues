# Spec for Fix Hono RPC Type Casts in userRequests

Title: Fix Hono RPC Type Casts in userRequests
Branch: claude/fix/fix-user-requests-type-casts
Spec file: context/specs/fix-user-requests-type-casts.md

## Summary

`packages/frontend/src/apis/userRequests.ts` contains six `as unknown as SomeType` casts when reading response bodies from the Hono RPC client. These casts silence TypeScript rather than actually aligning types, defeating the end-to-end type safety the Hono RPC setup is designed to provide. The fix is to identify each mismatch, correct it at the right layer (shared types, route return annotation, or frontend wrapper type), and remove the casts.

The six cast sites are:
- **L44** (`getUserProfile`): error body cast `as unknown as { error: string }` — repeated across all error paths
- **L48** (`getWeeksForYear`): `body.weeks as unknown as AdminDbWeekData[]`
- **L70** (`getUserPicks`): `body.picks as unknown as UserDbGameData[]`
- **L92** (`getPickedGames`): `body.pickedGames as unknown as AdminDbGameData[]`
- **L112** (`getUserPickHistory`): `data as unknown as UserPickHistoryResponse`
- **L151** (`getNotificationSettings`): `(await res.json()) as unknown as NotificationSettings`
- **L177** (`getBroadcastChannels`): `(await res.json()) as unknown as BroadcastChannelInfo`

## Functional Requirements

- Remove all `as unknown as SomeType` casts on success response bodies in `userRequests.ts`.
- Remove all `as unknown as { error: string }` casts on error response bodies in `userRequests.ts`.
- Where the inferred Hono RPC type already matches, delete the cast with no other changes.
- Where the inferred type is structurally different from what the frontend expects (e.g., `AdminWeekData` vs `AdminDbWeekData`, or a wrapped vs unwrapped response), fix the mismatch at the correct layer:
  - If the frontend wrapper type is wrong, update or remove it.
  - If a shared type is missing or misnamed, add or correct it.
  - If the route return annotation needs to be made more precise, update it.
- `BroadcastChannelInfo` is a locally-defined frontend type that mirrors the backend's literal response shape. It should either be moved to shared types or the frontend should rely on the Hono-inferred type directly.
- Error body handling (`{ error: string }`) should use the Hono-inferred type or a shared error type rather than a manual cast. All error paths across `userRequests.ts` use the same pattern, so fixing one should fix all.
- Do not change the observable behavior of any API function — only improve type correctness.
- Do not touch `adminRequests.ts` or `authRequests.ts` in this fix; scope is `userRequests.ts` only.

## Possible Edge Cases

- The Hono RPC client infers `Date` fields as `string` over the wire (JSON serialization). If a shared type uses `Date` and the inferred type uses `string`, the cast was hiding a real runtime difference. In that case the frontend type should use `string` (or the field should be narrowed correctly), not `Date`.
- `getUserPickHistory` returns `{ history: ... }` from the backend but the frontend's `PickHistoryResponse.data` is typed as `UserPickHistoryResponse` (which also wraps `history`). This double-wrapping may cause a real shape mismatch that needs to be unwrapped.
- `getNotificationSettings` returns the result of `returnNotificationSettings` directly. If that DB function's return type differs from `NotificationSettings` in shared types, the cast was hiding a real discrepancy — fix the source of truth rather than adding another cast.

## Acceptance Criteria

- No `as unknown as` casts remain in `userRequests.ts`.
- `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` passes with zero type errors.
- `pnpm build` passes with zero errors.
- All existing frontend tests pass without modification.
- The runtime behavior of each API function is unchanged (responses parsed and returned identically).

## Open Questions

- Should `BroadcastChannelInfo` be promoted to shared types, or should the frontend just use the Hono-inferred type inline? Prefer shared types if the backend also references this shape explicitly; otherwise inline inference is fine. - shared types sounds good

## Testing Guidelines

No new test cases are required — this is a type-only fix with no runtime behavior change. Confirm correctness via:
- TypeScript compile check: `npx tsc --noEmit -p packages/frontend/tsconfig.app.json`
- Full build: `pnpm build`
- Existing frontend tests: `pnpm test:frontend`

## Personal Opinion

This is a good and worthwhile fix. The Hono RPC client exists specifically to eliminate manual type assertions; leaving six casts in place means TypeScript won't catch any drift between backend response shapes and frontend assumptions. The scope is well-contained to one file with no schema or route changes, so the risk is low. The only complexity is diagnosing *why* each cast was needed — some will be trivially removable (the inferred type already matches), while others will expose a real type mismatch that needs a deliberate decision. That diagnostic step is the most valuable part.
