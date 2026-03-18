# Spec for DB Connection Options and Admin Bootstrap Security Fix

Title: DB Connection Options and Admin Bootstrap Security Fix
Branch: claude/fix/db-connection-admin-bootstrap-fix
Spec file: context/specs/db-connection-admin-bootstrap-fix.md

## Summary

Two medium-severity security issues:

1. **[7] DB connection string interpolation** — `packages/backend/src/db/index.ts` builds the Postgres connection URL via template literal. Any `DB_PASSWORD` containing URL-special characters (`@`, `/`, `#`, `?`, `%`) silently malforms the URL, causing connection failures or connecting with incorrect credentials. Fix by passing individual connection options to Drizzle instead of a composed URL string.

2. **[8] Admin bootstrap counts only active users** — `packages/backend/src/routes/auth.ts` promotes the first registrant to admin by checking `returnUsers().length === 0`. `returnUsers()` queries only the live `user.users` table, which excludes soft-deleted accounts stored in `user.deleted_users`. If the sole admin deletes their account, the next person to register automatically becomes admin — an unintended privilege escalation. Fix by including deleted user count in the bootstrap check.

## Functional Requirements

### [7] DB connection via individual options
- Replace the template-literal connection string with a structured config object passed to `drizzle()` (host, port, user, password, database as separate fields).
- No behavior change for standard alphanumeric credentials.
- Passwords with special characters must work correctly without manual encoding.

### [8] Admin bootstrap check includes deleted users
- Before promoting a registrant to admin, the check must confirm no user has *ever* registered — not just that no active user exists.
- Query both `user.users` and `user.deleted_users` (or sum their counts) to determine if any account has ever been created.
- If deleted users exist, the new registrant receives only the `user` role.
- A comment should document the intent of the bootstrap check so the behavior is clear to future maintainers.

## Possible Edge Cases

- **[7]** Drizzle `node-postgres` driver: confirm the structured-options API is stable and matches what `drizzle-orm/node-postgres` accepts.
- **[7]** `DB_SSL` env var is documented but not currently used in `db/index.ts` — the switch to structured options is a good time to wire it in if it isn't already; but only do so if it's clearly missing.
- **[8]** Race condition on simultaneous first-registration is pre-existing and out of scope.
- **[8]** The `deleted_users` table is an audit log populated on hard delete — it accurately represents all accounts ever removed.

## Acceptance Criteria

- [ ] `db/index.ts` no longer builds a URL string; credentials are passed as discrete fields.
- [ ] A `DB_PASSWORD` containing `@` or `/` does not break the Postgres connection.
- [ ] `POST /auth/register` checks total user count (active + deleted) before assigning admin.
- [ ] If `deleted_users` is non-empty and `users` is empty, a new registrant receives only the `user` role.
- [ ] A comment in `auth.ts` explains the bootstrap logic and its intent.
- [ ] `pnpm build` passes with no errors.

## Open Questions

- Does the existing `DB_SSL` env var need to be respected in the structured-options object? Check `envVars.ts` to see if it's already handled elsewhere before wiring it in `db/index.ts`.

## Testing Guidelines

Create or extend tests in `packages/backend/tests/`:

- **[7]** Unit test or integration smoke: if the driver accepts a mock config object, verify the host/user/password/database fields are forwarded correctly (no URL encoding required). If full integration testing is impractical, at minimum assert that the config object is constructed with the correct fields.
- **[8]** Unit test for the admin bootstrap logic:
  - When both `users` and `deleted_users` are empty → registrant gets `['user', 'admin']`.
  - When `users` is empty but `deleted_users` has one row → registrant gets `['user']` only.
  - When `users` has one row → registrant gets `['user']` only.

## Personal Opinion

Both fixes are straightforward and low-risk.

[7] is a real correctness bug — URL-special characters in passwords will silently break the connection. The fix is a one-liner swap and clearly correct. Worth doing.

[8] is a narrow but real privilege-escalation path: an admin who deletes their own account opens a window for any registrant to claim admin. The fix is also simple. The main judgment call is whether to add a `returnDeletedUsers()` DB function or inline a count query in `auth.ts`; a dedicated function is cleaner and testable.

No concerns about complexity — both are well-scoped with no schema changes required.
