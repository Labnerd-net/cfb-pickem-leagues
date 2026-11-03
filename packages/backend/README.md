# CFB Pickem API

Hono-based API for the CFB Pickem Leagues application. Handles authentication, leagues, user picks, leaderboards, notifications, and admin management of weekly game data. See the [root README](../../README.md) for the full project overview and setup.

## Tech Stack

- **Hono** — Web framework (exports `AppType` for the frontend's typed RPC client)
- **Drizzle ORM** — Type-safe queries, over Neon's serverless HTTP driver
- **PostgreSQL (Neon)** — Database
- **JWT** — Authentication via httpOnly cookie (bcryptjs for password hashing)
- **Zod** — Request validation
- **Resend** — Email notifications
- **TypeScript** — ESM with NodeNext module resolution
- **Cloudflare Workers** — Production runtime (`src/worker.ts`); `src/server.ts` is the local Node entry point

## Getting Started

```bash
# From the repo root
pnpm install
cd packages/backend
cp .env.example .env   # set DEV_DB, JWT_SECRET, CFBD_API_KEY
pnpm migrate
pnpm dev
```

The server starts at `http://localhost:3000`. A health check is available at `GET /health`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload (tsx watch) |
| `pnpm dev:worker` | Run the Cloudflare Worker locally via `wrangler dev` |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` / `pnpm start:prod` | Run compiled output (`start:prod` migrates first) |
| `pnpm generate` | Generate Drizzle migration files |
| `pnpm migrate` | Run pending migrations |
| `pnpm studio` | Open Drizzle Studio (visual DB browser) |
| `pnpm seed:dev` / `pnpm teardown:dev` | Seed / remove local simulation data |
| `pnpm deploy:worker` / `pnpm deploy:worker:dev` | Deploy to Cloudflare (prod / dev environment) |
| `pnpm test` | Run tests once (Vitest + in-process PGlite) |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |

## Environment Variables

Copy `.env.example` to `.env`. `.env.example` is the authoritative list; the essentials:

| Variable | Description |
|----------|-------------|
| `DEV_DB` | Neon connection string, used when `NODE_ENV != production` |
| `PROD_DB` | Neon connection string, used when `NODE_ENV = production` |
| `JWT_SECRET` | **Required.** Secret for signing tokens. Generate with `openssl rand -base64 32` |
| `CFBD_API_KEY` | **Required.** From https://collegefootballdata.com/ |
| `SERVER_PORT` | API server port (default `3000`) |
| `CLIENT_URL` | Allowed CORS origins, comma-separated |
| `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` | Optional; both are needed to enable email |

Broadcast channels (ntfy, Telegram, Discord) are configured per league in the UI and stored in the database.

## API Routes

Routes live in `src/routes/` and are mounted in `src/index.ts`:

| Mount | File | Access |
|-------|------|--------|
| `/api/auth` | `auth.ts` | Public (register, login, `me`, account deletion) |
| `/api/leagues` | `leagues.ts` | Authenticated; league-scoped routes require membership, settings require league admin |
| `/api/user` | `user.ts` | Authenticated (profile, picks, games, notification settings) |
| `/api/leaderboard` | `leaderboard.ts` | Authenticated |
| `/api/admin` | `admin.ts` | Site admin (game import, week/game curation, users) |
| `/api/admin/leagues` | `adminLeagues.ts` | Site admin (league management) |

Responses are returned directly with `c.json()` — there is no `ok`/`err` wrapper. Auth endpoints are rate limited.

## Database Schema

Defined in `src/db/schema/`. Weeks use a composite primary key `(year, week_number)`; picks use `(user_id, game_id)`.

- **`admin` schema** — reference data: `weeks`, `games`, `score_corrections`
- **`user` schema** — `users`, `games` (picks), `deleted_users`, `notification_preferences`, `notification_log`
- **`public` schema** — leagues: `leagues`, `league_members`, `league_games`, `league_channels`

## External Data Source

Game data comes from the [College Football Data API](https://collegefootballdata.com/) (`src/api/cfbd.ts`) and is normalized into shared types by `src/api/index.ts` before being stored.
