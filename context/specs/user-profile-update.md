# Spec for User Profile Update

Title: User Profile Update
Branch: claude/feature/user-profile-update
Spec file: context/specs/user-profile-update.md

## Summary

Users have no way to change their display name or password after registration. Add `PATCH /user/profile` on the backend accepting optional display name and/or password change fields, and expose both forms in the existing Settings page. On a successful update the JWT cookie must be re-issued so the auth context reflects the new display name immediately without a page reload.

## Functional Requirements

- `PATCH /user/profile` is an authenticated endpoint (requires `authMiddleware`)
- Request body accepts any combination of:
  - `displayName` — optional string, trimmed, 1–50 chars
  - `currentPassword` + `newPassword` — both required together if either is present
- At least one of the above changes must be present; an empty body returns 400
- Display name change: validate non-empty after trim, max 50 chars (matches registration rule), store updated value
- Password change: verify `currentPassword` against stored hash; validate `newPassword` with the existing `validatePassword()` utility; bcrypt-hash and store `newPassword`
- On success, re-issue the `auth_token` cookie with updated JWT payload (same expiry logic as login) so `AuthProvider` picks up the new `displayName` automatically
- Frontend: add a "Profile" section to the existing Settings page (`packages/frontend/src/pages/Settings.tsx`) above the current Account section with:
  - An editable display name field (pre-filled from auth context), save button, inline success/error feedback
  - A change-password form (current password, new password), submit button, inline success/error feedback

## Possible Edge Cases

- Both display name and password provided in the same request — treat as one atomic operation (update both in a single DB call)
- New password identical to current — valid, no need to block
- Display name unchanged (same value submitted) — succeeds silently
- Wrong `currentPassword` — return 401 with a generic message
- Display name trimmed to empty string — 400
- Display name exceeds 50 chars — 400
- `newPassword` sent without `currentPassword` (or vice versa) — 400

## Acceptance Criteria

- `PATCH /user/profile` with `{ displayName: "New Name" }` updates the stored name, returns 200, and sets a refreshed JWT cookie containing the new display name
- `PATCH /user/profile` with `{ currentPassword: "old", newPassword: "new8chars" }` verifies, hashes, stores, and returns 200
- `PATCH /user/profile` with incorrect `currentPassword` returns 401
- `PATCH /user/profile` with an empty body returns 400
- `PATCH /user/profile` with only one of `currentPassword`/`newPassword` returns 400
- `PATCH /user/profile` with `displayName` exceeding 50 chars returns 400
- Settings page pre-fills the display name field from the current auth context
- Saving display name updates the auth context (navbar/leaderboard reflect new name without reload)
- Change-password form validates that `newPassword` meets the existing password rules before submitting
- Both forms show per-field or form-level success and error feedback

## Open Questions

- Should a successful password change log out other active sessions? At ~15 users with cookie-based short-lived JWTs, the complexity is not warranted — skip for now. - ok skip for now

## Testing Guidelines

Create test files in `packages/backend/tests/` and `packages/frontend/tests/`. Keep coverage focused:

- Backend DB: `updateUserProfile` function — display name only, password only, both together
- Backend route: `PATCH /user/profile` — success with display name, success with password change, wrong current password (401), empty body (400), missing one of the password pair (400), JWT cookie present in 200 responses
- Frontend: Zod validation schema for the profile update form — display name min/max, password rules

## Personal Opinion

Solid, well-scoped feature. The key implementation decision is re-issuing the JWT on update — this is the right call and follows the same pattern already in `POST /auth/login`. No new patterns required. A single `updateUserProfile` DB function covering both fields makes the route handler clean. No concerns.
