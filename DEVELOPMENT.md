# Development Guide

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
