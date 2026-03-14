# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

College Football Pick'em game — a full-stack app where users predict college football game outcomes. Admins curate which games are available each week from external data sources, and users make picks against those games.

## Commands

### Development
```bash
pnpm dev:backend          # Start backend (tsx watch, port 3000)
pnpm dev:frontend         # Start frontend (vite, port 5173)
cd packages/frontend
pnpm preview              # Preview production build locally (port 4173)
```

### Season Simulation (dev only)
```bash
cd packages/backend
NODE_ENV=development pnpm seed:dev       # Insert 3 weeks of 2024 CFB data and mark all picked
NODE_ENV=development pnpm teardown:dev   # Remove seeded weeks/games/notification logs
```

Full simulation walkthrough in [DEVELOPMENT.md](./docs/DEVELOPMENT.md).

### Build & Lint
```bash
pnpm build                # Build all packages
pnpm lint                 # Lint all packages
pnpm lint:fix             # Lint with auto-fix
pnpm format               # Prettier format all packages
```

### Database
```bash
docker compose -f docker/docker-compose-pg.yml up -d   # Start PostgreSQL
cd packages/backend
pnpm generate             # Generate Drizzle migrations
pnpm migrate              # Run migrations
pnpm studio               # Open Drizzle Studio (DB browser)
```

### Type-checking (no dedicated script — run directly)
```bash
npx tsc --noEmit -p packages/backend/tsconfig.json
npx tsc --noEmit -p packages/frontend/tsconfig.app.json
```

### Testing
```bash
# Run all tests (root level)
pnpm test                 # Run all tests (backend + frontend)
pnpm test:backend         # Run backend tests only
pnpm test:frontend        # Run frontend tests only
pnpm test:coverage        # Run all tests with coverage reports

# Package-level test commands (run from packages/backend or packages/frontend)
cd packages/backend       # or packages/frontend
pnpm test                 # Run tests once
pnpm test:watch           # Run tests in watch mode (for development)
pnpm test:ui              # Run tests with Vitest UI
pnpm test:coverage        # Run tests with coverage report
```

**Test Database Setup (one-time):**
```bash
# Create separate test database to avoid affecting dev data
psql -U postgres -h localhost -c "CREATE DATABASE \"cfb-pickem-test\";"

# Run migrations against test database
cd packages/backend
NODE_ENV=test pnpm migrate
```

**Test Structure:**
- **Backend** (`packages/backend/tests/`): Unit tests for utilities, API converters, middleware; database function tests with real PostgreSQL; validation tests
- **Frontend** (`packages/frontend/tests/`): Form validation tests (Zod schemas); API request tests with MSW mocks
- **Testing Framework**: Vitest for both packages
- **Coverage Reports**: After running `pnpm test:coverage`, view HTML reports at `packages/backend/coverage/index.html` and `packages/frontend/coverage/index.html`

## Architecture

**Monorepo** managed by pnpm workspaces with three packages:

- **packages/backend** — Hono API server (ESM, NodeNext modules). Routes are in `src/routes/`, DB queries in `src/db/`, external API adapters in `src/api/`.
- **packages/frontend** — React 19 SPA built with Vite. Uses Material-UI for components, React Router for navigation, React Hook Form + Zod for forms.
- **packages/shared** — TypeScript types only (`types/cfb-pickem-api.ts`). Imported as `@shared/*` via tsconfig path alias.

### Backend Layers
1. **Routes** (`src/routes/`) — Hono route handlers. `auth.ts` is public; `user.ts` and `leaderboard.ts` require auth; `admin.ts` requires admin role.
2. **DB Functions** (`src/db/dbAdminFunctions.ts`, `dbUserFunctions.ts`, `dbNotificationFunctions.ts`) — Drizzle queries. Two PostgreSQL schemas: `admin` (reference data: weeks/games) and `user` (accounts and picks).
3. **API Adapters** (`src/api/`) — External data sources (NCAA, CFBD, SportsDataverse). Configurable via `DATA_SOURCE` env var. Converters in `src/api/index.ts` normalize data into shared types.
4. **Middleware** (`src/utils/middleware.ts`) — JWT auth middleware and `requireRole()` guard.
5. **Notifications** (`src/notifications/`) — `dispatcher.ts` routes events to `emailSender.ts` (SMTP via nodemailer) and/or `ntfySender.ts` (NTFY push). `templates.ts` holds message content.

### Auth Flow
JWT-based. Token is set as an **httpOnly cookie** by the backend (`auth_token`). The frontend Hono RPC client is initialized with `credentials: 'include'` so the cookie is sent automatically. `AuthProvider` determines auth state on mount by calling `GET /api/auth/me`. First registered user is auto-assigned admin role.

### Hono RPC Client
The frontend uses Hono's typed RPC client for end-to-end type safety. The backend exports `AppType` from `src/index.ts`; the frontend imports it (via tsconfig path alias `@backend/index.js`) and constructs the client in `src/lib/api.ts`:

```ts
import { hc } from 'hono/client';
import type { AppType } from '@backend/index.js';
export const client = hc<AppType>(import.meta.env.VITE_API_URL, { init: { credentials: 'include' } });
```

All frontend API functions in `src/apis/` (`authRequests.ts`, `userRequests.ts`, `adminRequests.ts`) call through this client. **Do not use `fetch` directly in new API functions.**

### Key Conventions
- Backend GET endpoints use query parameters for week selection: `?year=2024&week=1&seasonType=regular`.
- Backend POST/PATCH endpoints accept JSON bodies.
- Route handlers respond with `c.json()` directly — there is no `ok()`/`err()` wrapper utility.
- Route-level input validation uses `src/utils/zValidate.ts` with Zod schemas.
- Rate limiting is applied per-route via `src/utils/rateLimiter.ts` (`apiRateLimit` middleware).
- Frontend API functions are organized by domain in `src/apis/` — `authRequests.ts` for auth, `userRequests.ts` for user endpoints, `adminRequests.ts` for admin-only.

### Database Key Strategy
- **Weeks**: composite primary key `(year, weekNumber)` — no surrogate ID
- **Games**: `serial` auto-increment `game_id`
- **User picks** (`user.games`): composite primary key `(userId, gameId)` — picks-only join table; join with `admin.games` for game metadata

### Specs and Plans

- `context/specs/` — feature specification files. Each spec describes requirements, edge cases, and acceptance criteria for a feature. New specs are created via the `/spec` slash command.
- `context/features/` — implementation plan files paired with specs.

## Environment Variables

Backend expects these (defaults work for local dev with Docker):
```
# Database
DB_USER=postgres  DB_PASSWORD=postgres  DB_HOST=localhost  DB_PORT=5432  DB_NAME=cfb-pickem
DB_SSL=true                   # set in production for SSL connections

# Server
SERVER_PORT=3000
CLIENT_URL=http://localhost:5173,http://localhost:4173
NODE_ENV=production           # enables secure cookies

# Auth
JWT_SECRET=<must set in production>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7
JWT_SALT_ROUNDS=10            # bcrypt rounds for password hashing

# Data source
DATA_SOURCE=ncaa              # or cfbd, sdv
CFBD_API_KEY=<required if DATA_SOURCE=cfbd>

# Logging
LOG_LEVEL=info                # trace | debug | info | warn | error | fatal | silent

# Picks
PICKS_IGNORE_DEADLINE=false   # set true to bypass deadline enforcement (off-season testing)

# Season simulation (dev only — ignored in production)
DEV_CURRENT_TIME=             # ISO 8601 string to pin the backend clock, e.g. 2024-08-31T10:00:00Z

# Notifications (SMTP email)
NOTIFICATION_FROM_EMAIL=      # leave blank to disable email notifications
SMTP_HOST=                    # e.g. smtp.fastmail.com, smtp.gmail.com, or localhost (Mailpit)
SMTP_PORT=587                 # 587 for STARTTLS, 465 for TLS, 1025 for Mailpit
SMTP_USER=                    # leave blank if no auth (e.g. local Mailpit)
SMTP_PASS=
SMTP_SECURE=false             # set true only for port 465
SKIP_EMAIL_SEND=false         # set true in dev to log instead of sending

# Notifications (broadcast channels — admin-configured)
NTFY_TOPIC_URL=               # full ntfy URL including topic, e.g. https://ntfy.sh/cfb-pickem
TELEGRAM_BOT_TOKEN=           # bot token from BotFather
TELEGRAM_CHAT_ID=             # group or channel chat ID the bot will post to
TELEGRAM_INVITE_URL=          # public join link shown to users in Settings (e.g. https://t.me/yourchannel)
DISCORD_WEBHOOK_URL=          # Discord channel webhook URL
DISCORD_INVITE_URL=           # public invite link shown to users in Settings (e.g. https://discord.gg/abc123)
```

Frontend:
```
VITE_API_URL=http://localhost:3000
VITE_DEV_CURRENT_TIME=        # ISO 8601 string to pin the frontend clock (mirrors DEV_CURRENT_TIME)
```

## Checking Documentation

- **important:** when implementing any lib/framework-specific features, ALWAYS check the appropriate lib/framework documentation useing the Context7 MCP server before writing any code.
