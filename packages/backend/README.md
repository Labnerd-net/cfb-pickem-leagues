# CFB Pickem API

Hono-based REST API server for the CFB Pickem application. Handles authentication, user game picks, and admin management of weekly game data.

## Tech Stack

- **Hono** — Web framework
- **Drizzle ORM** — Type-safe database queries
- **PostgreSQL** — Database
- **JWT** — Authentication (bcryptjs for password hashing)
- **Zod** — Request validation
- **TypeScript** — ESM with NodeNext module resolution

## Getting Started

```bash
# From the repo root
docker compose -f docker/docker-compose-pg.yml up -d
cd packages/backend
pnpm install
pnpm migrate
pnpm dev
```

The server starts at `http://localhost:3000`. A health check is available at `GET /health`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload (tsx watch) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled output |
| `pnpm generate` | Generate Drizzle migration files |
| `pnpm migrate` | Run pending migrations |
| `pnpm studio` | Open Drizzle Studio (visual DB browser) |
| `pnpm lint` | Run ESLint |
| `pnpm prettier` | Format code with Prettier |

## Environment Variables

**⚠️ Security:** Copy `.env.example` to `.env` and set `JWT_SECRET` before running the server. The server will refuse to start without a valid `JWT_SECRET`.

```bash
cp .env.example .env
# Edit .env and set JWT_SECRET to a secure random string
# Generate one with: openssl rand -base64 32
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `cfb-pickem` | Database name |
| `SERVER_PORT` | `3000` | API server port |
| `CLIENT_URL` | `http://localhost:5173,...` | Allowed CORS origins (comma-separated) |
| `JWT_SECRET` | **REQUIRED** | **Secret key for signing tokens (must be set!)** |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_EXPIRATION_DAYS` | `7` | Token expiration in days |
| `JWT_SALT_ROUNDS` | `10` | Bcrypt salt rounds for password hashing |
| `DATA_SOURCE` | `ncaa` | External data source (`ncaa`, `cfbd`, or `sdv`) |
| `CFBD_API_KEY` | **Required if using CFBD** | API key (get from https://collegefootballdata.com/) |

## API Endpoints

### Authentication (`/api/auth`)

**Rate Limiting:** `/register` and `/login` endpoints are rate-limited to 5 attempts per 15 minutes per IP address to prevent brute force attacks.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Create a new account (first user gets admin role). Rate-limited. |
| POST | `/login` | No | Login, returns JWT token. Rate-limited. |
| DELETE | `/deleteUser` | JWT | Delete the authenticated user's account |

### User (`/api/user`)

All endpoints require a valid JWT token.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Get the authenticated user's profile |
| GET | `/picks?year=&week=&seasonType=` | Get the user's picks for a week |
| GET | `/games?year=&week=&seasonType=` | Get admin-curated games available for a week |
| POST | `/picks` | Submit game picks (JSON body) |

### Admin (`/api/admin`)

All endpoints require JWT + admin role.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/users` | List all user profiles |
| POST | `/year/:year` | Import all weeks for a year from external data source |
| POST | `/week` | Import games for a specific week |
| POST | `/getgames` | Get all games for a week |
| POST | `/setpicks` | Mark games as available for user picks |

### Response Format

All responses follow a consistent structure:

```json
// Success
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": "message", "code": 400 }
```

## Database Schema

The database uses two PostgreSQL schemas:

**`admin` schema** — Reference data managed by admins
- `weeks` — Season weeks with start/end dates
- `games` — All games with scores and completion status

**`user` schema** — User accounts and picks
- `users` — Accounts with email, password hash, and roles
- `games` — Individual user predictions linked to admin games

## External Data Sources

Game data can be pulled from three configurable sources (set via `DATA_SOURCE`):

- **`ncaa`** — NCAA API (default)
- **`cfbd`** — College Football Data API (requires `CFBD_API_KEY`)
- **`sdv`** — SportsDataverse

Data from any source is normalized into shared types before being stored.
