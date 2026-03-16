# Current Feature

## Current Feature Spec File

Title: ...
Spec file: ...
Branch: ...

## Current Feature Plan File

Plan File: ...

## History

<!-- Keep this updated. Earliest to latest -->
- **Auth and Input Validation Security Fixes** (backlog #1, #4, #5, #6): Added `game.picked` enforcement on `POST /user/picks`; applied `zValidator` to `POST /auth/register` and `POST /auth/login`; raised password min to 8 chars and enforced max 72 (bcrypt truncation limit); fixed middleware ordering on 6 routes so `authMiddleware` runs before validators; updated frontend registration schema to match.
- **Picks Transaction Rollback and Weeks Unique Constraint** (backlog #9, #12): Wrapped `POST /user/picks` inserts in `db.transaction()` via new `addPickedGamesBatch` — partial pick commits on mid-batch failure are no longer possible. Confirmed backlog [12] false positive: `admin.weeks(year, week_number)` primary key already enforces uniqueness.