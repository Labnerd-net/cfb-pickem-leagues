# Development Guide

## Environment Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/)
- A [Neon](https://neon.tech) project (a dedicated dev branch is recommended)
- A free [CFBD API key](https://collegefootballdata.com/)

### Backend environment

Copy `packages/backend/.env.example` to `packages/backend/.env` and fill in at least:

```env
DEV_DB=<neon connection string>     # used when NODE_ENV != production
PROD_DB=<neon connection string>    # used when NODE_ENV = production
CFBD_API_KEY=<your key>
JWT_SECRET=<openssl rand -base64 32>
CLIENT_URL=http://localhost:5173,http://localhost:4173
SERVER_PORT=3000
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7

# Optional — omit RESEND_API_KEY or NOTIFICATION_FROM_EMAIL to disable email
RESEND_API_KEY=
NOTIFICATION_FROM_EMAIL=noreply@yourdomain.com   # must be on your Resend-verified domain
SKIP_EMAIL_SEND=true                             # log emails instead of sending (dev)
```

### Frontend environment

Create `packages/frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

The app runtime and `drizzle-kit` both read `DEV_DB` / `PROD_DB`.

### Development without a Resend account

Set `SKIP_EMAIL_SEND=true` to log emails instead of sending. Verification tokens are still written to the DB, so you can read them in Drizzle Studio (`pnpm studio`) to test the verify-email flow.

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:backend` | Start backend dev server with hot reload |
| `pnpm dev:frontend` | Start frontend dev server with HMR |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm lint:fix` | Lint with auto-fix |
| `pnpm format` | Format code with Prettier |
| `pnpm test` | Run all tests (backend + frontend) |
| `pnpm test:backend` | Run backend tests only |
| `pnpm test:frontend` | Run frontend tests only |
| `pnpm test:coverage` | Run tests with coverage reports |

Backend-only scripts (run from `packages/backend`):

| Command | Description |
|---------|-------------|
| `pnpm seed:dev` | Insert 3 weeks of 2024 CFB seed data |
| `pnpm teardown:dev` | Remove seeded weeks, games, and notification logs |
| `pnpm generate` | Generate Drizzle migration files |
| `pnpm migrate` | Run pending migrations |
| `pnpm studio` | Open Drizzle Studio (DB browser) |

---

## Testing

The project uses [Vitest](https://vitest.dev/) for both backend and frontend packages. Backend tests run against an in-process [PGlite](https://github.com/electric-sql/pglite) database — no external DB required.

### Running Tests

```bash
# All packages
pnpm test
pnpm test:coverage

# Backend only
pnpm test:backend
cd packages/backend && pnpm test:watch   # watch mode

# Frontend only
pnpm test:frontend
cd packages/frontend && pnpm test:watch
```

After running coverage, view HTML reports at:
- `packages/backend/coverage/index.html`
- `packages/frontend/coverage/index.html`

### Test Structure

**Backend** (`packages/backend/tests/`):
- `unit/utils/` — clock, validation, logger utilities
- `unit/db/` — Drizzle query functions (admin, user, notification)
- `unit/routes/` — pick deadline enforcement
- `unit/notifications/` — email and NTFY senders
- `unit/cronLogic.test.ts` — cron scheduling logic
- `routes/` — full route integration tests (auth, admin, users, leaderboard, notifications, dev endpoints)

**Frontend** (`packages/frontend/tests/`):
- Form validation (Zod schemas)
- API request functions with MSW mocks

---

## Local Season Simulation

The app is time-sensitive — pick deadlines and score refresh all depend on the system clock. To exercise the full pick → results → leaderboard → notification flow locally without live external data or real dates, use the seed script and fake clock.

### 1. Seed historical game data

```bash
cd packages/backend
NODE_ENV=development pnpm seed:dev
```

Inserts 3 weeks of 2024 CFB data (weeks 1–3, kickoffs Aug 31 / Sep 7 / Sep 14) with real team matchups and marks all games as available for picks. Safe to run multiple times — upserts on conflict.

### 2. Start with a simulated clock

Set `DEV_CURRENT_TIME` to a time **before** the first week 1 kickoff (19:30 UTC Aug 31) so games appear open for picking. Both env vars must be set to keep frontend lock state and backend deadline enforcement in sync.

```bash
# Terminal 1 — backend
DEV_CURRENT_TIME=2024-08-31T10:00:00Z NODE_ENV=development pnpm dev:backend

# Terminal 2 — frontend
VITE_DEV_CURRENT_TIME=2024-08-31T10:00:00Z pnpm dev:frontend
```

### 3. Submit picks

Log in as a regular user. Games should be open and picks submittable. The Dev Tools tab (admin Dashboard, Vite dev mode only) shows the active simulated time.

### 4. Advance the clock past kickoff

Restart both servers with a later time to simulate kickoff passing:

```bash
DEV_CURRENT_TIME=2024-08-31T21:00:00Z NODE_ENV=development pnpm dev:backend
VITE_DEV_CURRENT_TIME=2024-08-31T21:00:00Z pnpm dev:frontend
```

Picks submitted now will be rejected (422 — game locked).

### 5. Mark games complete

Log in as admin and open the **Dev Tools** tab on the Dashboard. The "Mark Games Complete" panel lists all picked games for the selected week. Enter final scores and click **Mark Complete** — the winning team is calculated automatically. Once all games in a week are marked complete, a `rankings_updated` notification is dispatched.

Alternatively, via curl:

```bash
# Get auth cookie
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "yourpassword"}'

# Get game IDs for week 1
curl -s -b cookies.txt "http://localhost:3000/api/admin/games?year=2024&week=1" \
  | jq '.weekGames[] | {gameId, homeTeam, awayTeam}'

# Mark a game complete
curl -s -b cookies.txt -X POST http://localhost:3000/api/admin/games/complete \
  -H "Content-Type: application/json" \
  -d '{"gameId": 1, "homePoints": 34, "awayPoints": 3}'
```

### 6. Check results

Switch to the user view to see correct/incorrect picks and the updated leaderboard.

### 7. Tear down

```bash
cd packages/backend
NODE_ENV=development pnpm teardown:dev
```

Removes all seeded weeks, games, and notification logs. User picks cascade-delete automatically.

### Clock behaviour

| Env var | Scope | Effect |
|---------|-------|--------|
| `DEV_CURRENT_TIME` | Backend | Pins `getNow()` used for pick deadline checks and cron logic. Ignored in production. |
| `VITE_DEV_CURRENT_TIME` | Frontend (build-time) | Pins the frontend clock used to display game lock state. |
| localStorage `devCurrentTime` | Frontend (runtime) | Set via the Dev Tools tab; overrides `VITE_DEV_CURRENT_TIME`. Cleared by clicking "Real Time". |

The backend clock resets to `DEV_CURRENT_TIME` (or real time) on every server restart, including `tsx watch` auto-reloads triggered by file saves.

## Demo Environment

A public, isolated demo: its own Worker (`cfb-pickem-leagues-demo`), its own Neon `demo` branch, pinned to 2024-09-18, with one-click login and a nightly reset. Config lives in the `demo` block of `wrangler.jsonc`. The design is in `context/specs/demo-mode.md`.

### One-time setup

1. **Create the Neon branch.** In the `CFB-picker` project, create a branch named `demo` as a **schema-only** copy. Do not copy data from `production`: it would carry real user emails and password hashes into a branch a public Worker connects to. Copy its connection string.
2. **Generate the game data** (only needed again if the seeded weeks change):
   ```bash
   cd packages/backend
   CFBD_API_KEY=<real key> pnpm export:demo-games   # writes src/demo/demoGameData.ts; commit it
   ```
   The deployed Worker bundles this file. The reset refuses to run while it is the empty placeholder.
3. **Seed it.** Put the demo connection string in `packages/backend/.env.demo` (gitignored by `.env.*`). **Quote the value**, because Neon strings contain `&`, which the shell treats as "run in background" and silently leaves the variable empty:
   ```
   DEV_DB="postgres://...demo branch string..."
   DEMO_MODE=true
   JWT_SECRET=local-seed-only
   CFBD_API_KEY=not-a-real-key
   ```
   `JWT_SECRET` and `CFBD_API_KEY` only need to pass env validation here. Then, in one shell:
   ```bash
   cd packages/backend
   set -a; source .env.demo; set +a
   echo "$DEV_DB" | sed -E 's#.*@([^/:?]+).*#\1#'   # must print the DEMO host, not your dev host
   NODE_ENV=development pnpm seed:demo --wipe-host=<that host>
   ```
   Sourcing the file matters: `dotenv` does not override variables already set, so a plain `pnpm seed:demo` would read `DEV_DB` from `.env` (your real dev branch). The `--wipe-host` check is the safety net for that mistake.
4. **Set the secrets** on the demo Worker:
   ```bash
   npx wrangler secret put DEV_DB --env demo          # the demo branch string
   npx wrangler secret put JWT_SECRET --env demo      # openssl rand -base64 32; never reuse prod or dev
   npx wrangler secret put CFBD_API_KEY --env demo    # any placeholder; the demo never calls CFBD
   ```
   Do not set `PROD_DB`, `RESEND_API_KEY`, or `NOTIFICATION_FROM_EMAIL`. With `DEMO_MODE` on, the Worker refuses to serve requests if `PROD_DB` is bound or `NODE_ENV=production`.

### Deploy

```bash
pnpm --filter cfb-pickem-api deploy:worker:demo
```

This builds the demo frontend first (`build:demo` writes `packages/frontend/dist-demo` with `VITE_DEMO_MODE` on and the pinned clock) and the `demo` environment serves only that directory, so the normal bundle and the demo bundle cannot be swapped. The wrangler warning about `kv_namespaces` not being inherited is expected: the demo's scheduled job is the reset, which does not use the cron cache.

### Reset on demand

Re-run the seed command from step 3. The nightly reset runs the same code in the Worker. Both keep the two demo accounts at user IDs 1 and 2, so a visitor's session survives a reset.

### Adding routes safely

- `/api/admin/*` is deny-by-default in the demo (`src/utils/demoGuard.ts`). A new admin route is blocked until you add it to `DEMO_ADMIN_ALLOWED` or `DEMO_ADMIN_BLOCKED`, and a test fails if a registered admin route is in neither list.
- Anything that sends messages, calls CFBD, or changes shared accounts must stay blocked.
- Frontend controls that the guard blocks are disabled with a note (`IS_DEMO`, `DemoDisabledNote`).
