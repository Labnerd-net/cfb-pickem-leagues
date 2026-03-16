# Spec for Auth and Input Validation Security Fixes

Title: Auth and Input Validation Security Fixes
Branch: claude/feature/auth-input-validation-security
Spec file: context/specs/auth-input-validation-security.md

## Summary

Four security issues in the auth and input validation layer need to be addressed:

1. **[Backlog #1]** `POST /user/picks` never verifies that each submitted game has `picked === true` (i.e., the admin has included it in the week's slate). A user can submit a pick for any game in `admin.games` — including excluded ones — by providing a valid `gameId` directly via the API.

2. **[Backlog #4]** `POST /auth/register` and `POST /auth/login` call `c.req.json()` without a Zod validator. Malformed or unexpected JSON throws a 500 instead of returning a 400. These routes are also inconsistent with every other mutation route in the codebase, which use `zValidator` middleware.

3. **[Backlog #5]** Password validation sets a minimum length of 6 characters with no upper bound. bcrypt silently truncates inputs over 72 bytes, meaning a long password produces a weaker hash with no warning to the user. There are also no complexity requirements.

4. **[Backlog #6]** On `PATCH /admin/users/:id/roles` and `POST /user/picks`, Zod validators run before `authMiddleware`. This causes unauthenticated requests to receive a 400 (schema error) instead of a 401 (unauthorized), leaking schema structure to anonymous callers.

## Functional Requirements

- `POST /user/picks`: For each game in the submitted picks, verify the game record has `picked === true` before accepting the pick. Return a 422 if any submitted game is not part of the curated slate.
- `POST /auth/register` and `POST /auth/login`: Apply `zValidator` middleware for request body validation, consistent with other mutation routes. Malformed or missing fields must return a 400.
- Password validation: Raise the minimum password length to 8 characters. Enforce a server-side maximum of 72 characters and return a 400 before hashing if exceeded (bcrypt silently truncates above 72 bytes). Update both frontend and backend validation to reflect the new rules.
- Route middleware ordering: Reorder middleware on all affected routes so `authMiddleware` (and `requireRole` where applicable) runs before Zod validators. The correct order is: `authMiddleware → requireRole → zValidator`.

## Possible Edge Cases

- A user submitting a mix of valid (picked) and invalid (not picked) game IDs — the entire submission should be rejected, not partially accepted.
- Passwords exactly at the 72-character boundary should be accepted; 73+ should be rejected.
- Existing users with passwords longer than 72 characters would have been hashed at truncation — no migration is needed, but they will need to reset their password if they exceed the new max. In practice this is unlikely since the current UI has no explicit max. Acceptable tradeoff for a small self-hosted app.
- After reordering middleware on `POST /user/picks`, an unauthenticated request with a valid body should get a 401, not a 400.

## Acceptance Criteria

- [ ] Submitting a pick for a game with `picked = false` returns 422 with a clear error message.
- [ ] `POST /auth/register` and `POST /auth/login` return 400 for malformed/missing JSON instead of 500.
- [ ] Registering with a password shorter than 8 characters returns 400.
- [ ] Registering with a password longer than 72 characters returns 400.
- [ ] Registering with a password between 8–72 characters succeeds.
- [ ] Unauthenticated `POST /user/picks` returns 401, not 400.
- [ ] Unauthenticated `PATCH /admin/users/:id/roles` returns 401, not 400.
- [ ] All existing passing tests continue to pass.

## Open Questions

- Should the `POST /user/picks` 422 response name the invalid game IDs, or just say "one or more games are not available this week"? (Naming them is slightly more useful but leaks game IDs to the caller — probably fine since the caller supplied them.) - whatever you think is best
- Should password complexity (uppercase, number, symbol) be required, or is length alone sufficient? The backlog item does not require complexity, so length-only is the proposed scope. - length is good for now.

## Testing Guidelines

Create or update tests in `packages/backend/tests/` for:

- `POST /user/picks` with a non-curated game ID returns 422.
- `POST /user/picks` unauthenticated returns 401 (not 400).
- `POST /auth/register` with missing body fields returns 400.
- `POST /auth/login` with missing body fields returns 400.
- `POST /auth/register` with a 7-character password returns 400.
- `POST /auth/register` with a 73-character password returns 400.
- `POST /auth/register` with an 8-character password succeeds.
- `PATCH /admin/users/:id/roles` unauthenticated returns 401.

Frontend: update Zod schema in the registration form to enforce min 8 / max 72.

## Personal Opinion

All four items are straightforward, high-confidence fixes. None require schema changes or significant refactoring. The middleware reorder ([6]) and Zod addition to auth routes ([4]) are almost mechanical. The game-slate check ([1]) is a real access control gap worth fixing promptly. The password bounds ([5]) are sensible hygiene.

The only mild concern: existing users with very long passwords (>72 chars) would silently have had weaker hashes — this fix doesn't retroactively fix those hashes. It's a known limitation but acceptable for a small-scale app. Document it in a code comment.

Overall: good set to batch together. Low risk, clear scope, meaningful security improvement.
