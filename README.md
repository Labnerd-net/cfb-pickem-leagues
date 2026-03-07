# CFB Pickem

A full-stack College Football Pick'em application where users predict the outcomes of college football games each week. Admins curate the weekly game slate from external data sources, and users submit their picks against those games.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router, Material-UI, React Hook Form, Vite |
| Backend | Hono, Drizzle ORM, JWT Authentication |
| Database | PostgreSQL (via Docker) |
| Shared | TypeScript types across frontend and backend |
| Tooling | pnpm workspaces, TypeScript, ESLint, Prettier |

## Project Structure

```
cfb-pickem/
  packages/
    backend/    # Hono API server
    frontend/   # React SPA
    shared/     # Shared TypeScript types
  docker/       # PostgreSQL Docker Compose config
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v22+)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for PostgreSQL)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start the database

```bash
docker compose -f docker/docker-compose-pg.yml up -d
```

### 3. Run database migrations

```bash
cd packages/backend
pnpm migrate
```

### 4. Configure environment variables

Create a `.env` file in `packages/backend/`:

```env
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cfb-pickem
SERVER_PORT=3000
CLIENT_URL=http://localhost:5173,http://localhost:4173
JWT_SECRET=your-secret-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7
DATA_SOURCE=ncaa
LOG_LEVEL=info
PICKS_IGNORE_DEADLINE=false

# Notifications (optional — omit NOTIFICATION_FROM_EMAIL to disable email)
NOTIFICATION_FROM_EMAIL=noreply@yourdomain.com
RESEND_API_KEY=your-resend-api-key
SKIP_EMAIL_SEND=true   # set true in dev to log emails instead of sending
```

Create a `.env` file in `packages/frontend/`:

```env
VITE_API_URL=http://localhost:3000
```

### 5. Start development servers

```bash
# In separate terminals, or use two panes:
pnpm dev:backend     # API server on http://localhost:3000
pnpm dev:frontend    # Frontend on http://localhost:5173
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for testing, scripts, and local season simulation.

## Self-Hosting with Docker Compose

Pre-built images are published to GitHub Container Registry on every push to `main`.

### 1. Create a `.env` file

```env
# Database
DB_PASSWORD=your-db-password

# Backend
JWT_SECRET=your-jwt-secret          # generate with: openssl rand -base64 32
CLIENT_URL=https://yourdomain.com

# Internal backend URL — how nginx reaches the backend container
# Default (http://cfb-backend:3000) matches the docker-compose service name
BACKEND_URL=http://cfb-backend:3000

# Notifications (optional — omit NOTIFICATION_FROM_EMAIL to disable email)
NOTIFICATION_FROM_EMAIL=noreply@yourdomain.com
RESEND_API_KEY=your-resend-api-key
```

### 2. Download the compose file

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/Labnerd-net/cfb-pickem/main/docker/docker-compose.yml
```

### 3. Start the stack

```bash
docker compose up -d
```

The backend automatically runs database migrations on startup. The first user to register is assigned the admin role.

### Updating

```bash
docker compose pull
docker compose up -d
```

---

## How It Works

1. The first user to register is automatically assigned the **admin** role.
2. Admins import weekly schedules from an external data source (NCAA, CFBD, or SportsDataverse) and select which games are available for picking.
3. Authenticated users view the curated games for a given week and submit their predictions (home or away team).
4. As games complete, results are updated and users can see how their picks performed.
5. Admins can promote or demote other users' roles via the admin panel.

## Notifications

The app supports two notification channels: **email** (via [Resend](https://resend.com)) and **push** (via [ntfy](https://ntfy.sh)).

Three notification types are sent automatically:

| Type | Trigger |
|------|---------|
| `games_ready` | Admin imports games for a week |
| `picks_reminder` | 60–75 minutes before the first kickoff of a week |
| `rankings_updated` | All games in a week are complete and scores are final |

Users configure their preferences on the `/settings` page. Each type × channel combination can be toggled independently. Email notifications require email verification. NTFY notifications require saving an ntfy server URL in settings.

### Cron

Score refresh and picks reminders run on a 15-minute cron inside the Hono process (`node-cron`). No external scheduler is required. The cron uses in-memory state and the `notificationLog` table to avoid duplicate sends.

### Development without Resend

Set `SKIP_EMAIL_SEND=true` to bypass Resend entirely. Verification tokens are still written to the DB — you can retrieve them directly via Drizzle Studio (`pnpm studio`) to test the verify-email flow locally.
