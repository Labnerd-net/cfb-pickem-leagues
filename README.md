# CFB Pickem Leagues

A full-stack College Football Pick'em application. Users join one or more private **leagues**, predict the outcome of college football games each week, and compete on per-league leaderboards. A site admin curates which games are available each week from [College Football Data](https://collegefootballdata.com/) (CFBD), and league admins manage their own members and notification channels.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router, Material-UI, React Hook Form + Zod, Vite |
| Backend | Hono (typed RPC client shared with the frontend), Drizzle ORM, JWT auth (httpOnly cookie) |
| Database | PostgreSQL on [Neon](https://neon.tech), via the serverless HTTP driver |
| Hosting | Cloudflare Workers (API + static frontend assets, cron trigger) |
| Shared | TypeScript types in `packages/shared` |
| Tooling | pnpm workspaces, TypeScript, ESLint, Prettier, Vitest |

## Project Structure

```
packages/
  backend/    # Hono API (routes, Drizzle DB functions, CFBD adapter, notifications, cron)
  frontend/   # React SPA
  shared/     # Shared TypeScript types
docs/         # Development, notifications, and infrastructure guides
context/      # Feature specs, plans, and history
scripts/      # Repo-level helper scripts
wrangler.jsonc  # Cloudflare Workers config (prod + dev environments)
```

## Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/)
- A [Neon](https://neon.tech) project (a dedicated dev branch is recommended)
- A free [CFBD API key](https://collegefootballdata.com/)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

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

Create `packages/frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

The app runtime only reads `DEV_DB` / `PROD_DB`. The `DB_*` variables in `.env.example` are used solely by `drizzle-kit` when no Neon string is set.

### 3. Run database migrations

```bash
cd packages/backend
pnpm migrate
```

### 4. Start development servers

```bash
pnpm dev:backend     # API on http://localhost:3000
pnpm dev:frontend    # Frontend on http://localhost:5173
```

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for testing, scripts, and local season simulation.

## How It Works

1. The first user to register becomes the site **admin** and is given a Default League automatically.
2. The site admin imports weekly schedules from CFBD and selects which games are available for picking.
3. Users join leagues via invite link (`/join/<inviteCode>`) or invite code. Site admins can create new leagues.
4. Within a league, users view the curated games for a week and pick the winner (home or away) before the deadline.
5. As games complete, results update and each league's weekly and season leaderboards are recalculated. Rankings are by pick percentage, with a minimum-participation threshold.
6. League admins manage members, regenerate invite codes, and configure the league's notification channels.

## Notifications

Notifications are sent on three events:

| Type | Trigger |
|------|---------|
| `games_ready` | Admin imports games for a week |
| `picks_reminder` | 60–75 minutes before the first kickoff of a week |
| `rankings_updated` | All games in a week are complete and scores are final |

Channels:

- **Email** (via [Resend](https://resend.com)): per-user. Users toggle each type on the `/settings` page; email must be verified first. Configured with the `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` env vars.
- **Broadcast channels** (ntfy, Telegram, Discord): configured **per league** by league admins in League Settings and stored in the database. Users join the league's channel (topic, group, or server) to receive messages.

See [docs/NOTIFICATIONS.md](./docs/NOTIFICATIONS.md) for channel details.

### Cron

Score refresh and pick reminders run every 15 minutes. In production this is a Cloudflare Workers cron trigger (`wrangler.jsonc`) handled by `runCronTick`; the cron short-circuits when there is no active week so it doesn't wake the database in the off-season. The local Node server (`pnpm dev:backend`) runs the same tick via `node-cron`. The `notificationLog` table prevents duplicate sends.

### Development without a Resend account

Set `SKIP_EMAIL_SEND=true` to log emails instead of sending. Verification tokens are still written to the DB, so you can read them in Drizzle Studio (`pnpm studio`) to test the verify-email flow.

## Deployment

Production runs on Cloudflare Workers with a Neon `PROD_DB`. A separate `dev` Worker environment (reading `DEV_DB`, cron disabled) exists for verifying branches before merge.

```bash
pnpm build
pnpm --filter cfb-pickem-api deploy:worker       # production
pnpm --filter cfb-pickem-api deploy:worker:dev   # dev environment
```

Secrets are set once per environment with `wrangler secret put <KEY>` (add `--env dev` for the dev Worker). See `wrangler.jsonc` for the required list and [docs/INFRASTRUCTURE_MIGRATION.md](./docs/INFRASTRUCTURE_MIGRATION.md) for background.
