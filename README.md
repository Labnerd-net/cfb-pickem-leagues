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
JWT_EXPIRATION_DAYS=7
DATA_SOURCE=ncaa
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

## Testing

The project uses [Vitest](https://vitest.dev/) for testing both backend and frontend packages.

### Running Tests

```bash
# Run all tests
pnpm test

# Run backend tests only
pnpm test:backend

# Run frontend tests only
pnpm test:frontend

# Run with coverage reports
pnpm test:coverage

# Run in watch mode (for development)
cd packages/backend  # or frontend
pnpm test:watch
```

### Test Coverage

After running `pnpm test:coverage`, view the detailed coverage reports in your browser:

- Backend: `packages/backend/coverage/index.html`
- Frontend: `packages/frontend/coverage/index.html`

### Test Database Setup

The backend tests use a separate PostgreSQL database (`cfb-pickem-test`) to avoid affecting development data:

```bash
# Create the test database (one-time setup)
psql -U postgres -h localhost -c "CREATE DATABASE \"cfb-pickem-test\";"

# Run migrations against test database
cd packages/backend
NODE_ENV=test pnpm migrate
```

The test database is automatically seeded and cleaned between tests.

### Test Structure

**Backend Tests** (`packages/backend/tests/`):
- Unit tests for utilities, API converters, middleware
- Database function tests with real PostgreSQL
- Validation tests for email/password rules

**Frontend Tests** (`packages/frontend/tests/`):
- Form validation tests (Zod schemas)
- API request tests with MSW mocks
- Component tests with React Testing Library (coming soon)

## How It Works

1. The first user to register is automatically assigned the **admin** role.
2. Admins import weekly schedules from an external data source (NCAA, CFBD, or SportsDataverse) and select which games are available for picking.
3. Authenticated users view the curated games for a given week and submit their predictions (home or away team).
4. As games complete, results are updated and users can see how their picks performed.
