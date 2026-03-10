# Dokploy Deployment Guide

This guide covers deploying the full CFB Pick'em stack to Dokploy: PostgreSQL database, backend API, and frontend.

## Prerequisites

- Dokploy instance running
- Git repository accessible to Dokploy (GitHub, GitLab, etc.)
- Domain names (or Dokploy-generated subdomains) ready for backend and frontend

---

## 1. Deploy the Database

### Create PostgreSQL Service

1. In Dokploy, go to your project and click **Create Service → Database → PostgreSQL**
2. Give it a name (e.g. `cfb-pickem-db`)
3. Set:
   - **Database name**: `cfb-pickem`
   - **Username**: `postgres`
   - **Password**: a strong password (save this — you'll need it for the backend)
4. Click **Create**

### Note the Internal Hostname

Once created, go to the database's **General** tab. Note the **Internal hostname** — it looks like `cfb-pickem-db.dokploy-network` (or similar). Use this as `DB_HOST` in the backend environment variables. Do not expose the database port externally.

### Verify Connection (Optional)

Use the **Terminal** tab in the Dokploy database panel to confirm the database is running:

```sql
\l   -- list databases
```

You should see `cfb-pickem` listed.

---

## 2. Deploy the Backend

The backend uses `Dockerfile` at the repo root. On startup it automatically creates the `admin` and `user` schemas and runs any pending Drizzle migrations before starting the Hono server.

### Create the Application

1. In Dokploy, click **Create Service → Application**
2. Connect your Git repository and select the branch to deploy (e.g. `main`)
3. Under **Build**, set:
   - **Build type**: `Dockerfile`
   - **Dockerfile path**: `./Dockerfile`
   - **Build context**: `.` (repo root)
4. Set **Port**: `3000`

### Environment Variables

In the **Environment** tab, add:

```bash
# Database
DB_USER=postgres
DB_PASSWORD=your_db_password_here
DB_HOST=cfb-pickem-db.dokploy-network   # internal hostname from step 1
DB_PORT=5432
DB_NAME=cfb-pickem

# Server
SERVER_PORT=3000
NODE_ENV=production

# JWT — generate with: openssl rand -base64 32
JWT_SECRET=your_secure_random_secret_here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7

# CORS — set after frontend is deployed
CLIENT_URL=https://your-frontend-domain.com

# Data source
DATA_SOURCE=ncaa
# CFBD_API_KEY=your_key_here   # only needed if DATA_SOURCE=cfbd

# Notifications (optional)
# NTFY_URL=https://ntfy.sh/your-topic
# SES_FROM_EMAIL=noreply@yourdomain.com
```

### Domain / Port Binding

1. Go to the **Domains** tab and add your backend domain (e.g. `api.yourdomain.com`)
2. Dokploy will provision a Traefik reverse proxy entry automatically

### Deploy

Click **Deploy**. Watch the logs — a successful startup looks like:

```
Creating database schemas...
Schemas ready
Starting database migrations...
Migrations completed successfully
Server running on port 3000
```

If migrations fail the container exits immediately (by design) — check the logs for DB connection or credential issues.

### Automatic Deploys

To trigger a deploy on every push to `main`:

**Option A: Dokploy webhook (recommended)**

1. In the application's **General** tab, enable **Auto Deploy**
2. Copy the **Webhook URL**
3. In GitHub → repo **Settings → Webhooks → Add webhook**:
   - Payload URL: the Dokploy webhook URL
   - Content type: `application/json`
   - Trigger: "Just the push event"

**Option B: GitHub Actions**

Store the webhook URL as `DOKPLOY_DEPLOY_WEBHOOK` in GitHub secrets, then:

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: curl -X POST "${{ secrets.DOKPLOY_DEPLOY_WEBHOOK }}"
```

---

## 3. Deploy the Frontend

The frontend uses `Dockerfile.frontend`. `VITE_API_URL` is baked into the bundle at build time — it must be provided as a Docker build argument, not a runtime env var.

### Create the Application

1. In Dokploy, click **Create Service → Application**
2. Connect the same Git repository, same branch
3. Under **Build**, set:
   - **Build type**: `Dockerfile`
   - **Dockerfile path**: `./Dockerfile.frontend`
   - **Build context**: `.` (repo root)
4. Set **Port**: `80`

### Build Arguments

In the **Build Arguments** (not environment variables) tab, add:

```
VITE_API_URL=https://api.yourdomain.com
```

This must match the domain you set for the backend. If you change the backend domain later, you must update this build arg and redeploy the frontend.

### Domain / Port Binding

1. Go to the **Domains** tab and add your frontend domain (e.g. `yourdomain.com` or `picks.yourdomain.com`)
2. Dokploy/Traefik handles SSL termination

### Update Backend CORS

Once the frontend domain is confirmed, go back to the **backend** service's environment variables and update:

```bash
CLIENT_URL=https://your-frontend-domain.com
```

Then redeploy the backend.

### Deploy

Click **Deploy**. The frontend serves static files via nginx. It has no runtime dependencies other than the browser being able to reach the backend URL.

---

## How Migrations Work

The `start:prod` script in `packages/backend/package.json`:

```json
"start:prod": "pnpm migrate:prod && node dist/src/index.js"
```

On each deploy this:
1. Connects to PostgreSQL using the DB env vars
2. Creates the `admin` and `user` schemas if they don't exist
3. Applies all pending Drizzle migrations from the `./drizzle` folder
4. Starts the Hono server only if migrations succeed (exits with code 1 otherwise)

When you modify the schema locally:

```bash
cd packages/backend
pnpm generate   # generates new migration files in ./drizzle
```

Commit the generated files to Git. They run automatically on next deploy.

---

## Troubleshooting

### Docker build fails: DNS resolution error / can't reach registry.npmjs.org

If the build fails with `bad address 'registry.npmjs.org'` or a similar fetch error during pnpm install, Docker containers on the host can't resolve DNS. This is caused by UFW's default `deny (routed)` policy blocking container traffic.

Fix: add explicit DNS servers to the Docker daemon config on the Dokploy host:

```bash
sudo nano /etc/docker/daemon.json
```

```json
{
  "dns": ["8.8.8.8", "1.1.1.1"]
}
```

```bash
sudo systemctl restart docker
```

Verify it works before redeploying:

```bash
docker run --rm node:20-alpine sh -c "wget -q -O- https://registry.npmjs.org/pnpm | head -c 100"
```

You should see a JSON response. Then redeploy in Dokploy.

### Backend can't connect to database

- Confirm `DB_HOST` uses the internal Dokploy hostname (not `localhost` or an external IP)
- Check that both services are in the same Dokploy project/network
- Verify `DB_PASSWORD` matches what was set when creating the database

### Manual schema creation (if needed)

Use the **Terminal** tab in the Dokploy database panel:

```sql
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS "user";
```

### SSL/TLS connection errors

The migration script sets `ssl: { rejectUnauthorized: false }` for production, which handles self-signed certificates common in Dokploy-managed databases.

### Migration files missing from image

Confirm the backend Dockerfile includes:

```dockerfile
COPY --from=build /app/packages/backend/drizzle ./packages/backend/drizzle
```

### Frontend shows blank page or 404 on refresh

nginx is configured with a React Router fallback (`try_files $uri $uri/ /index.html`). If this is missing, check `nginx.conf` at the repo root.

### CORS errors in the browser

Ensure:
- `CLIENT_URL` in the backend env matches the exact frontend origin (including `https://`, no trailing slash)
- The backend was redeployed after updating `CLIENT_URL`

---

## Security Notes

1. Never commit `.env` files with production credentials
2. Use Dokploy's environment variable management for all secrets
3. Generate a strong `JWT_SECRET`: `openssl rand -base64 32`
4. Keep the database port internal — do not expose it outside the Dokploy network
5. Use strong, unique passwords for `DB_PASSWORD`
