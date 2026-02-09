# CFB Pickem UI

React single-page application for the CFB Pickem game. Provides user registration, login, and interfaces for viewing games and submitting weekly picks.

## Tech Stack

- **React 19** — UI framework
- **React Router 7** — Client-side routing
- **Material-UI 7** — Component library (with system dark mode support)
- **React Hook Form + Zod** — Form handling and validation
- **Axios** — HTTP client
- **Vite 7** — Build tool with HMR
- **TypeScript** — Strict mode enabled

## Getting Started

```bash
cd packages/frontend
pnpm install
pnpm dev
```

The app starts at `http://localhost:5173`. Make sure the backend is running at `http://localhost:3000` (or set `VITE_API_URL`).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot module replacement |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Preview the production build locally |
| `pnpm lint` | Run ESLint |
| `pnpm prettier` | Format code with Prettier |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | Backend API base URL |

## Project Structure

```
src/
  apis/           # HTTP client functions organized by domain
    userRequests.ts     # User-accessible endpoints (profile, picks, games)
    adminRequests.ts    # Admin-only endpoints (manage weeks, games, users)
    authRequests.ts     # Authentication (register, login)
  components/     # React components
    registration.tsx    # User registration form
    login.tsx           # Login form
  App.tsx          # Root component — theme provider, router setup
  main.tsx         # Entry point
```

## Key Patterns

- **Authentication**: JWT tokens are stored in `localStorage` and sent as `Authorization: Bearer` headers on API requests.
- **Theming**: Material-UI configured with system color mode preference (light/dark) via `CssBaseline` and `ThemeProvider`.
- **API Layer**: All backend calls go through typed functions in `src/apis/`. GET requests pass data as query parameters; POST requests use JSON bodies.
- **Shared Types**: TypeScript interfaces are imported from `@shared/types/cfb-pickem-api` (the `packages/shared` workspace package) to keep frontend and backend in sync.

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/login` | `LoginForm` | User login |
| `/register` | `RegistrationForm` | New user registration |
