# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

College Football Pick'em game — a full-stack app where users predict college football game outcomes. Admins curate which games are available each week from external data sources, and users make picks against those games.

## Commands

### Development
```bash
pnpm dev:backend          # Start backend (tsx watch, port 3000)
pnpm dev:frontend         # Start frontend (vite, port 5173)
```

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

## Architecture

**Monorepo** managed by pnpm workspaces with three packages:

- **packages/backend** — Hono API server (ESM, NodeNext modules). Routes are in `src/routes/`, DB queries in `src/db/`, external API adapters in `src/api/`.
- **packages/frontend** — React 19 SPA built with Vite. Uses Material-UI for components, React Router for navigation, React Hook Form + Zod for forms.
- **packages/shared** — TypeScript types only (`types/cfb-pickem-api.ts`). Imported as `@shared/*` via tsconfig path alias.

### Backend Layers
1. **Routes** (`src/routes/`) — Hono route handlers. `auth.ts` is public; `user.ts` requires auth; `admin.ts` requires admin role.
2. **DB Functions** (`src/db/dbAdminFunctions.ts`, `dbUserFunctions.ts`) — Drizzle queries. Two PostgreSQL schemas: `admin` (reference data: weeks/games) and `user` (accounts and picks).
3. **API Adapters** (`src/api/`) — External data sources (NCAA, CFBD, SportsDataverse). Configurable via `DATA_SOURCE` env var. Converters in `src/api/index.ts` normalize data into shared types.
4. **Middleware** (`src/utils/middleware.ts`) — JWT auth middleware and `requireRole()` guard.

### Auth Flow
JWT-based. Tokens stored in localStorage on frontend, sent as `Authorization: Bearer` headers. First registered user is auto-assigned admin role.

### Key Conventions
- Backend GET endpoints use query parameters (not JSON bodies) for `WeekIdData` (`?year=2024&week=1&seasonType=regular`).
- Backend POST endpoints accept JSON bodies.
- All API responses use `ok(data)` / `err(message, code)` wrappers from `src/utils/response.ts`.
- Frontend API functions are organized by domain in `src/apis/` — `userRequests.ts` for user-accessible endpoints, `adminRequests.ts` for admin-only.

### Database ID Strategy
- **Week ID**: `year * 1000 + adjustment + weekNumber` (adjustment: 0=regular, 100=postseason, 900=other)
- **User Game ID**: `gameId * 1000 + userId` (composite key encoding)

## Environment Variables

Backend expects these (defaults work for local dev with Docker):
```
DB_USER=postgres  DB_PASSWORD=postgres  DB_HOST=localhost  DB_PORT=5432  DB_NAME=cfb-pickem
SERVER_PORT=3000
CLIENT_URL=http://localhost:5173,http://localhost:4173
JWT_SECRET=<must set in production>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7
DATA_SOURCE=ncaa          # or cfbd, sdv
CFBD_API_KEY=<required if DATA_SOURCE=cfbd>
```

Frontend: `VITE_API_URL=http://localhost:3000`

## Checking Documentation

- **important:** when implementing any lib/framework-specific features, ALWAYS check the appropriate lib/framework documentation useing the Context7 MCP server before writing any code.
