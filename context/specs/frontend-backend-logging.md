# Spec for frontend-backend-logging

branch: claude/feature/frontend-backend-logging

## Summary

Add a structured logging system to both the backend (Hono API) and frontend (React SPA) to surface actionable debug information in production deployments (Dokploy/Docker). The backend uses Pino for structured, human-readable logs written to stdout so they are visible via `docker logs`. The frontend logs to the browser console only, controlled by an environment variable.

## Functional Requirements

- **Backend (Pino)**
  - Use Pino as the logging library with human-readable output (pino-pretty or equivalent)
  - Log all incoming HTTP requests (method, path, status code, response time)
  - Log all outgoing external API calls (NCAA, CFBD, SDV) including URL, status, and duration
  - Log database query errors with relevant context (function name, parameters)
  - Log application startup info (port, data source, DB connection status)
  - Log auth events (login success, login failure, token validation failure)
  - All logs must include a timestamp and severity level (INFO, WARN, ERROR, DEBUG)
  - Respect a `LOG_LEVEL` environment variable to control verbosity (default: `info`)
  - Output must go to stdout so Docker/Dokploy can capture it via `docker logs`
  - No sensitive data (passwords, JWT secrets) must appear in logs

- **Frontend (console only)**
  - Log API request failures (endpoint, HTTP status, error message) to the browser console
  - Log auth errors (token missing, token expired, 401 responses) to the browser console
  - All frontend logging is controlled by a `VITE_LOG_LEVEL` build-time environment variable
  - When `VITE_LOG_LEVEL` is not set or set to `off`, no console output is produced
  - No log data is sent to the backend or any external service

## Possible Edge Cases

- Pino should not crash the app if it fails to write a log entry
- Frontend logging guard must ensure no console output leaks into production unless `VITE_LOG_LEVEL` is explicitly set
- High request volume could produce noisy logs — `LOG_LEVEL=warn` should be usable to quiet things down in production
- No sensitive fields (passwords, raw tokens) must be logged even at `debug` level

## Acceptance Criteria

- `docker logs <backend-container> -f` shows timestamped, human-readable request logs for every API call
- Setting `LOG_LEVEL=debug` in Dokploy backend env vars produces verbose output; `LOG_LEVEL=warn` suppresses routine request logs
- Auth failures and external API errors appear in backend logs with enough context to diagnose
- Frontend console logs API and auth errors only when `VITE_LOG_LEVEL` is set (e.g. `VITE_LOG_LEVEL=debug`)
- No console output appears in production frontend builds when `VITE_LOG_LEVEL` is unset
- No passwords, JWT tokens, or secrets appear in any log output

## Open Questions

- Should `LOG_LEVEL=debug` include full request/response bodies, or just metadata (method, path, status)? - I guess just metadata for now
- Should Pino use `pino-pretty` directly in production, or pipe raw JSON through it only in development? (Raw JSON is more docker-friendly for future log shipping) - raw json is fine.

## Testing Guidelines

Create test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:

- Backend logger respects `LOG_LEVEL` — debug messages suppressed at `info` level
- Request logging middleware captures method, path, status, and duration
- Auth event logging fires on login success and failure
- Logger does not include password or token fields in output
- Frontend logger is a no-op when `VITE_LOG_LEVEL` is not set
- Frontend logger writes to console when `VITE_LOG_LEVEL=debug`

## Personal Opinion

This is the right approach. Pino to stdout is the correct production logging pattern for a Dockerized Node.js app — it's low overhead, compatible with `docker logs`, and forward-compatible with log shippers if you ever add Axiom or similar later.

Keeping the frontend to console-only is also the right call. Shipping frontend logs to the backend adds complexity and a new attack surface for no meaningful gain at this scale — browser DevTools covers the frontend debugging use case well.

The `LOG_LEVEL` env var is worth doing from the start. In production you will want `warn` or `error` to avoid log noise; in Dokploy you can temporarily bump it to `debug` to diagnose a specific issue.
