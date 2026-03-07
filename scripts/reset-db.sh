#!/usr/bin/env bash
# reset-db.sh — Drop and recreate the admin and user schemas, then run migrations.
#
# Usage:
#   DATABASE_URL=postgresql://... ./scripts/reset-db.sh
#   or
#   ./scripts/reset-db.sh postgresql://...

# postgresql://postgres:postgres@100.67.203.88:5432/cfb-pickem

set -euo pipefail

DATABASE_URL="${1:-${DATABASE_URL:-}}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "Error: no database URL provided."
  echo "Usage: DATABASE_URL=postgresql://... $0"
  echo "   or: $0 postgresql://..."
  exit 1
fi

echo "WARNING: This will drop all data in the 'admin' and 'user' schemas."
read -r -p "Are you sure? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

echo "→ Dropping schemas..."
psql "$DATABASE_URL" <<'SQL'
DROP SCHEMA IF EXISTS "admin" CASCADE;
DROP SCHEMA IF EXISTS "user" CASCADE;
SQL

echo "→ Running migrations..."
cd "$(dirname "$0")/../packages/backend"

# Parse the DATABASE_URL into individual env vars for drizzle.config.ts
# Format: postgresql://user:password@host:port/dbname
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:]+):.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

export DB_USER DB_PASSWORD DB_HOST DB_PORT DB_NAME

pnpm migrate

echo "✓ Database reset complete."
