# Dokploy Deployment Guide

This guide explains how to deploy the CFB Pick'em backend to Dokploy with automatic database migrations.

## Prerequisites

- Dokploy instance running
- PostgreSQL database created in Dokploy
- Database credentials ready

## Migration Strategy

The application uses a **custom migration script** (`src/scripts/migrate-prod.ts`) that runs automatically on each deployment before the app starts. This ensures your database schema is always up-to-date.

The migration script:
- Uses `drizzle-orm`'s `migrate()` function (more reliable than CLI in production)
- Handles SSL connections with self-signed certificates
- Limits concurrent connections during migration
- Includes proper error handling and logging

## Dokploy Configuration

### 1. Create Application

1. In Dokploy, create a new **Docker** application
2. Connect your Git repository
3. Set the **Dockerfile path**: `./Dockerfile`

### 2. Environment Variables

Configure these environment variables in Dokploy:

```bash
# Database Configuration
DB_USER=postgres
DB_PASSWORD=your_db_password_here
DB_HOST=your_dokploy_postgres_host
DB_PORT=5432
DB_NAME=cfb-pickem

# Server Configuration
SERVER_PORT=3000
NODE_ENV=production

# JWT Configuration (CRITICAL: Generate a secure secret!)
JWT_SECRET=your_secure_random_secret_here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7

# CORS Configuration
CLIENT_URL=https://your-frontend-domain.com

# Data Source
DATA_SOURCE=ncaa
# CFBD_API_KEY=your_key_here  # Only if using DATA_SOURCE=cfbd
```

**Important:**
- Generate a strong `JWT_SECRET`: `openssl rand -base64 32`
- Update `CLIENT_URL` with your actual frontend domain
- If using an external database, set `DB_HOST` to the database hostname

### 3. Build Configuration

- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start:prod` (this runs migrations then starts the app)
- **Port**: 3000

### 4. Automatic Deployments

Two options for triggering deploys on every push to `main`:

**Option A: GitHub webhook (recommended)**

1. In Dokploy, open your application → **General** tab
2. Enable the **Auto Deploy** toggle
3. Copy the **Webhook URL** from the **General → Refresh Token** section
4. In GitHub → repo **Settings → Webhooks → Add webhook**
   - Payload URL: paste the Dokploy webhook URL
   - Content type: `application/json`
   - Which events: "Just the push event"
5. Save — pushes to the configured branch now trigger deploys automatically

**Option B: GitHub Actions**

Store the Dokploy webhook URL as a GitHub secret (`DOKPLOY_DEPLOY_WEBHOOK`), then add a workflow:

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

### 5. Deploy

Click **Deploy** in Dokploy. The deployment will:
1. Build the Docker image
2. Install dependencies
3. Compile TypeScript
4. **Automatically create database schemas** (`admin` and `user`)
5. Run migrations automatically (`pnpm migrate:prod`)
6. Start the application

Watch the Dokploy logs to confirm everything runs successfully. You should see:
```
Creating database schemas...
✅ Schemas ready
Starting database migrations...
✅ Migrations completed successfully
```

**Note:** Schema creation is now automatic! The migration script creates the `admin` and `user` schemas if they don't exist, so no manual SQL commands are needed.

## How It Works

The `start:prod` script in `packages/backend/package.json`:
```json
"start:prod": "pnpm migrate:prod && node dist/src/index.js"
```

This runs:
1. `migrate:prod` → Executes `src/scripts/migrate-prod.ts` with `NODE_ENV=production`
2. `node dist/src/index.js` → Starts the Hono server (only if migrations succeed)

The migration script (`src/scripts/migrate-prod.ts`):
- Uses a dedicated PostgreSQL connection pool
- Applies all pending migrations from `./drizzle` folder
- Handles SSL connections (required for most managed databases)
- Exits with code 1 if migration fails (prevents app startup)

## Troubleshooting

### Manual Schema Creation (if needed)

Schemas are created automatically by the migration script. If you need to create them manually:

**Option 1: Dokploy Database Terminal**
1. Go to your PostgreSQL database in Dokploy dashboard
2. Open the **Terminal** or **SQL Editor**
3. Run:
```sql
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS "user";
```

**Option 2: Using psql command-line**
```bash
psql -U postgres -h your_dokploy_host -d cfb-pickem -c "CREATE SCHEMA IF NOT EXISTS admin; CREATE SCHEMA IF NOT EXISTS \"user\";"
```

**Option 3: Docker exec (if you have container access)**
```bash
docker exec -it <postgres-container-name> psql -U postgres -d cfb-pickem -c "CREATE SCHEMA IF NOT EXISTS admin; CREATE SCHEMA IF NOT EXISTS \"user\";"
```

### SSL/TLS Connection Issues

If you see SSL-related errors, the migration script automatically handles this for production by setting:
```typescript
ssl: { rejectUnauthorized: false }
```

This allows connections to databases with self-signed certificates (common in Dokploy).

### Migration Files Missing

Ensure the Dockerfile copies the `drizzle` folder:
```dockerfile
COPY --from=build /app/packages/backend/drizzle ./packages/backend/drizzle
```

### Migrations Not Running

Check Dokploy logs for:
- Environment variable issues (DB credentials)
- Network connectivity to database
- Schema permissions

## Local Testing

Test the production migration script locally:

```bash
cd packages/backend

# Set production environment
NODE_ENV=production DB_HOST=localhost pnpm migrate:prod

# Or test the full production start command
pnpm start:prod
```

## Database Management

### Generating New Migrations

When you modify the schema locally:

```bash
cd packages/backend
pnpm generate  # Creates new migration files in ./drizzle
```

Commit the new migration files to Git. On next deploy, they'll run automatically.

### Accessing Drizzle Studio in Production

For production database inspection, you can temporarily run Drizzle Studio locally against the production database:

```bash
# Set production DB credentials
DB_HOST=your_dokploy_db_host DB_USER=postgres DB_PASSWORD=xxx pnpm studio
```

**Warning:** Be careful when modifying production data.

## Security Notes

1. **Never commit** `.env` files with production credentials
2. Use Dokploy's environment variable management
3. Rotate `JWT_SECRET` regularly
4. Restrict database access to Dokploy network only
5. Use strong passwords for `DB_PASSWORD`

## Frontend Deployment

The frontend should be deployed separately (Vercel, Netlify, or Dokploy static site):
1. Set `VITE_API_URL=https://your-backend-domain.com`
2. Add frontend URL to backend's `CLIENT_URL` env var for CORS
