# Spec for demo-mode

Title: Demo Mode
Branch: claude/feature/demo-mode
Spec file: context/specs/demo-mode.md

## Summary
A publicly shareable, fully isolated demo of the app for portfolio visitors and employers. It runs as its own Cloudflare Worker (`demo` environment) against its own Neon `demo` branch, with the clock pinned to a point in the 2024 season and pre-seeded data (a demo league, fake users, picks, completed weeks with scores, and an upcoming week). Visitors skip registration and sign in with one click as either a regular demo user or a limited demo admin. The demo admin can exercise the real admin workflow (curating the league's game pool from games already in the database, correcting scores, viewing users and logs) but cannot do anything destructive, outward-facing, or dependent on the external CFBD API. The database is reset nightly, and production is never reachable from the demo.

## Functional Requirements

### Environment and isolation
- A new `demo` deployment environment with its own Worker, its own secrets, and its own Neon `demo` branch. The demo Worker has no production database credentials, and its JWT secret differs from production and dev.
- The demo Worker's scheduled handler runs only the nightly reset. It must never run the normal cron tick (which imports from CFBD and sends notifications).
- Demo behavior is controlled by a `DEMO_MODE` backend flag and a `VITE_DEMO_MODE` frontend flag. With the flags off (production, dev, local), the app behaves exactly as it does today.
- The frontend is built at build time, so the demo needs its own build configuration (demo API URL, demo flag, pinned frontend clock) that is kept separate from the production build. A demo build must never be deployable to production, and vice versa.
- The backend clock is pinned via `DEV_CURRENT_TIME`, and the frontend clock via `VITE_DEV_CURRENT_TIME`, to the same moment in the 2024 season. The pinned clock must be verified to actually take effect on the deployed Worker, not just locally. The codebase notes that `NODE_ENV` is inlined at build time on Workers, so the clock's production check may need to follow the same runtime mechanism the DB layer uses.

### Seed data
- Games and weeks are seeded for the 2024 season, building on the existing dev seed data and extending it:
  - Earlier weeks are completed with final scores, so the leaderboard, history, and week views are populated.
  - One upcoming week has picks open, for the visitor to pick in.
  - One further week has games in the global game cache that are not yet in the demo league's pool, so the demo admin has real curation work to do. Curation must work purely by adding and removing games already in the database, with no external API call.
- One demo league, with fake members who have pre-filled picks for the completed weeks, plus the regular demo user and the demo admin as members.
- The regular demo user has the plain user role and is a regular member of the demo league.
- The demo admin has the site admin role and is an admin of the demo league. The "limited" part comes from the demo guard, not from a reduced role.
- All seeded email addresses use a reserved non-deliverable domain. Seeded league notification channels are left empty.
- Some seeded notification log entries, so the admin log viewer has content.

### Demo login and registration
- A "Try the demo" section on the login page, shown only when `VITE_DEMO_MODE` is on, offering two choices: sign in as the demo user, or sign in as the demo admin. No email, password, or verification is needed.
- A `POST /api/auth/demo-login` endpoint that issues the normal auth cookie for the chosen seeded account. The route exists only when `DEMO_MODE` is on (it is not registered otherwise). It can only log in as the two designated demo accounts and takes no arbitrary user identifier. It has a strict rate limit.
- Registration is disabled in demo mode: the register endpoint refuses requests, and the register link and form are hidden in the frontend. Email/password login for arbitrary accounts is also not offered in the demo UI.

### Demo guard
- A guard on the backend, active only when `DEMO_MODE` is on, returns 403 with a clear message for blocked actions. Admin routes are **deny by default**: only the allowlisted routes below work, so any admin route added in future is blocked until it is classified.
- Allowed admin actions (site admin):
  - View the user list.
  - View weeks and games.
  - Correct game scores.
  - View notification logs.
- Allowed league-admin actions:
  - View the league's game cache and add or remove games from the league pool.
  - Rename the league.
  - View the league's notification channel settings.
  - Regenerate the invite code.
  - Create a league.
- Blocked admin actions:
  - Changing any user's roles or password.
  - Importing a year or a week's games from CFBD.
  - Syncing results from CFBD.
  - Deleting a year.
  - User export.
  - Notification test sends.
  - Admin and league broadcasts.
  - Saving league notification channel settings (this would let a visitor point the server at arbitrary outbound URLs).
  - Deleting a league.
- Blocked non-admin actions: account deletion, profile changes, password changes, email verification resend.
- Changing or removing league members is blocked when the target is one of the demo accounts, so a visitor cannot demote, remove, or lock out the shared accounts.
- Allowed for everyone: viewing everything, making and changing picks, joining leagues, and viewing the leaderboard and history.
- The frontend hides or disables controls for blocked actions with a short explanation where practical, so visitors rarely hit a raw 403.

### Banner
- A persistent banner on every page states that this is a demo and that data resets nightly at midnight Central time. It shows a live countdown to the next reset and notes that the season is fixed to 2024.
- The countdown uses the real current time and the America/Chicago time zone, not the pinned demo clock. At zero it shows a "resetting" state until the reset has run, then returns to counting down.

### Nightly reset
- A scheduled job on the demo Worker resets the demo database to the seeded state every night at midnight America/Chicago. Cloudflare cron triggers run in UTC, so the schedule must handle the daylight saving shift (two UTC triggers with the handler checking the Chicago local time, or an equivalent approach).
- The demo accounts keep the same user IDs across resets, so a visitor's session cookie stays valid after a reset.
- The reset removes visitor-created data (leagues, memberships, picks, score corrections, log entries) and restoring seeded data.
- The reset logic must be reusable by both the Worker's scheduled handler and a local script. It must use a small number of database requests (single multi-row statements or one batch), because the DB driver is HTTP-based and Workers limit outbound requests per invocation. It must be safe to re-run after a partial failure and must log failures.
- The owner has a way to trigger a reset on demand, such as running the script locally against the demo database.

### Notifications
- The demo environment sends no email, push, Telegram, or Discord messages. This is enforced by configuration (no email API key, email sending skipped), by the empty seeded channel settings, and by the guard blocking channel edits. It is not merely hidden in the UI.

### Documentation
- Update the README and development docs with how the demo is built, deployed, configured, reset, and linked from the portfolio.

## Possible Edge Cases
- Score corrections trigger the normal "rankings updated" notification flow. In the demo this must dispatch nothing real.
- Many visitors share the same two accounts, overwriting each other's picks and admin changes. Acceptable, but the app should not break.
- A visitor acts right before or during the nightly reset.
- The reset fails partway and leaves the demo half-seeded, or exceeds Worker request limits if implemented as many separate statements.
- The pinned clock leaves no week with open picks, or the "open" week's deadline is already past.
- A demo admin corrects scores or curates the pool into a state that makes the week odd until the next reset. For example, removing all games from a week that has picks (the existing rules may already refuse this).
- `DEMO_MODE` accidentally set in production would block real admin features, and `demo-login` accidentally exposed in production would be an auth bypass. Misconfiguration must fail safe.
- The demo frontend build accidentally deployed to production, or the production build to the demo.
- Direct API calls to blocked routes (not just UI clicks).
- In-memory rate limiting on a Worker without the rate limit bindings is per-isolate and weak. The demo-login limit may need the real bindings.
- The demo runs in a non-production mode (needed for the pinned clock), which affects secure-cookie behavior. Confirm the auth cookie still works on the demo's HTTPS URL.
- A visitor's session spans a reset: the JWT must still resolve to a valid demo user afterward.
- The scheduled run is a few minutes late or early, so the countdown reaches zero before the reset completes.
- The countdown on a visitor's device with a wrong clock or different time zone; it should still be computed against Central time.
- Daylight saving transitions: midnight Central is 05:00 or 06:00 UTC depending on the date, and the reset must run exactly once per night.
- Visitors creating a league, then the reset needing to remove it along with its members, games, and channels.
- Seed scores for completed games: they should be accurate historical results or clearly illustrative, not accidental nonsense.

## Acceptance Criteria
- ✅ The demo is reachable at https://cfbpickem-demo.labnerd.net/ and shows the login page with "Try the demo" and no registration option.
- ✅ One click signs the visitor in as the demo user or the demo admin.
- ✅ The demo user sees a populated leaderboard and history for completed weeks, and can make picks in the open week.
- ✅ The demo admin can open the admin pages, view users, add and remove games from the league pool for the curation week, and correct a score, with the leaderboard updating accordingly.
- ✅ No admin action in the demo calls the CFBD API.
- ✅ Every blocked action returns 403 from the API with a clear message, and the UI does not offer it.
- ✅ A new admin route that has not been added to the allowlist is blocked in demo mode.
- ✅ The demo accounts cannot be demoted, removed, or locked out by a visitor.
- ✅ A demo banner is visible on every page, states that data resets nightly at midnight Central, and shows a countdown that matches the next reset time in Central time (including across daylight saving changes).
- ✅ After the nightly reset (or an on-demand reset), the demo database matches the seeded state.
- ✅ The pinned clock works on the deployed demo Worker.
- ✅ The demo Worker holds no production database credentials and sends no email or push notifications.
- ✅ With demo flags off, production and dev behavior are unchanged: `demo-login` does not exist, registration works, nothing is blocked.
- ✅ `pnpm build` passes, and the feature has been verified on the deployed demo Worker.

## Open Questions
Resolved with the proposed defaults:
- Clock pinned after week 3 completes and before week 4 kicks off. Week 4 is open for picks, week 5 is the curation week. Five weeks of games, built on the existing sim seed.
- Seeded final scores are real 2024 results, fetched once and committed as static seed data.
- Nightly reset is an in-Worker SQL wipe and reseed, not a Neon branch reset.
- Visitors can create new leagues; the reset cleans them up.

- The demo URL is https://cfbpickem-demo.labnerd.net/ (a custom domain on the Cloudflare Worker).
- The nightly reset runs at midnight America/Chicago, with a countdown in the banner.

Still open:
- Is the labnerd.net zone managed in the same Cloudflare account as the Worker? (Needed for the custom domain; assumed yes.)

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- `demo-login` is not registered when `DEMO_MODE` is off, and when on issues a cookie only for the two demo accounts.
- The register endpoint is rejected when `DEMO_MODE` is on, and works normally when off.
- The demo guard returns 403 for each blocked route when `DEMO_MODE` is on, and does not interfere when off.
- Deny-by-default: a test that enumerates the registered admin routes and fails if any route is neither on the demo allowlist nor explicitly blocked.
- Allowed routes (picks, viewing, joining leagues, adding and removing league games, score correction) still work in demo mode.
- Member changes targeting a demo account are rejected; targeting other members are allowed.
- The reset routine restores the seeded state after data has been modified (using the in-process PGlite setup), and is safe to run twice.
- Frontend: the "Try the demo" options and the demo banner render only when `VITE_DEMO_MODE` is on, and the register link is hidden.
- Countdown calculation: next midnight in America/Chicago for several instants, including around both daylight saving transitions, independent of the pinned demo clock.
- Reset scheduling: the handler runs the reset only when the Chicago local hour is midnight, and not twice in one night.
- Reset keeps the demo accounts' user IDs stable.

## Personal Opinion
This is a good idea for a portfolio project. A live, clickable app is far more convincing than screenshots, and isolating it on its own Worker and database keeps real users' data out of reach. The scope is moderate: the dev environment, pinned clock, and seed scripts already exist, but it touches auth, middleware, seed data, the cron entry point, the frontend build, and docs. I'd consider splitting it into phases (environment and seed, then login and guard, then banner and reset), as was done for multi-league.

Concerns:
- Auth bypass risk: `demo-login` is a passwordless login. Mitigation: register the route only when `DEMO_MODE` is on, restrict it to the two accounts, and have startup refuse to run in demo mode if production database credentials are present.
- The pinned clock may not work on a deployed Worker because of how `NODE_ENV` is inlined (inferred from comments in the DB layer; not yet tested). Mitigation: verify early on a deployed demo Worker before building anything else on it.
- The existing seed scripts insert rows one at a time and exit the process, so they cannot be reused as the in-Worker reset as they are. Mitigation: refactor the seed data into a shared module with a batch-based reset. This is a real part of the work.
- The demo's non-production mode changes secure-cookie behavior. Mitigation: confirm on the deployed URL.
- Shared accounts mean visitors see each other's changes. Mitigation: the banner sets expectations.
- Hard-coding 2024 will eventually look dated. Mitigation: say so in the banner and README.
