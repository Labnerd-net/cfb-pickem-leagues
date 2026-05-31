# Infrastructure Migration: Multi-Tenant Reliability

## Why Migrate from Self-Hosted Dokploy

Moving to multi-tenant means downtime affects all league owners, not just you. Self-hosted VMs fail in unpredictable ways (disk full, OOM, kernel updates, host provider outages), and you become on-call for infrastructure. Managed platforms handle restarts, deploys, health checks, and host-level failures automatically.

---

## Recommended Path: Fly.io + Neon

### 1. Neon (Database)

Migrate the PostgreSQL database to Neon first — it's the highest-risk single point of failure in a self-hosted setup.

**Why Neon:**
- Serverless PostgreSQL — scale-to-zero between college football seasons reduces cost
- Already using Drizzle + `DB_SSL=true`, so migration is mostly a connection string swap
- Built-in connection pooler handles the Node.js server case
- Database branching replaces the manual separate test DB setup
- 99.9% SLA, maintained infrastructure

**Migration steps:**
```bash
# Run migrations against Neon
DATABASE_URL="postgresql://user:pass@host.neon.tech/dbname?sslmode=require" pnpm migrate

# Update .env
DB_HOST=your-project.neon.tech
DB_USER=your-neon-user
DB_PASSWORD=your-neon-password
DB_NAME=neondb
DB_PORT=5432
DB_SSL=true
```

### 2. Fly.io (Backend)

Deploy the Hono Node.js server to Fly.io with no dependency changes required.

**Why Fly.io:**
- Deploys as a Docker image — same mental model as Dokploy
- Multiple VM instances with automatic failover
- Health checks and auto-restarts built in
- No Node.js runtime changes needed (unlike Cloudflare Workers)
- `fly launch` auto-detects the Node.js/Docker setup

### 3. Cloudflare Pages (Frontend)

Deploy the React/Vite SPA to Cloudflare Pages.

**Why Cloudflare Pages:**
- Trivial deployment from the `packages/frontend` build output
- Global CDN with no configuration
- Free tier is generous
- Zero change to the frontend code

---

## Cloudflare Workers (Backend) — Future Option

Cloudflare Workers would give edge distribution and potentially lower latency, but it is not a drop-in replacement for the current Node.js backend. These dependencies break on the Workers runtime:

| Dependency | Issue | Fix Required |
|---|---|---|
| `nodemailer` | TCP/SMTP — no TCP in Workers | Switch to Resend HTTP SDK |
| `bcrypt` | Native addon | Replace with `bcryptjs` or Web Crypto |
| In-memory rate limiter | State lost between requests/instances | Use Cloudflare KV or Durable Objects |
| Node.js built-ins | Not all are available in Workers | Audit and replace as needed |

Hono natively supports Workers, and Drizzle + Neon's serverless driver works well there, so the path is viable — but it is a real migration project, not a config change.

**Verdict:** Don't start here. Migrate to Fly.io first to solve the reliability problem with minimal scope. Evaluate Workers later if latency or cost becomes a driver.

---

## Migration Sequence

1. **Neon first** — removes the scariest single point of failure, low code risk
2. **Fly.io backend** — no dependency changes, solves the on-call problem
3. **Cloudflare Pages frontend** — trivial, do alongside or after Fly.io
4. **Cloudflare Workers** — optional future step if edge latency becomes a requirement
