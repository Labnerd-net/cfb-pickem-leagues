#!/bin/bash
set -euo pipefail  # Exit on error, undefined variables, and pipe failures

baseFolder="/home/bladner/Documents/programming/cfb-pickem"
backend="${baseFolder}/packages/backend"
frontend="${baseFolder}/packages/frontend"
adminSchemaFile="${backend}/src/db/schema/admin.ts"
usersSchemaFile="${backend}/src/db/schema/users.ts"

cd "${backend}"

# Stop Docker containers
echo "Stopping Postgres docker container"
docker compose -f "${baseFolder}/docker/docker-compose-pg.yml" down

# Clean up data and drizzle files
echo "Removing DB files and drizzle migrate files"
rm -Rf "${baseFolder}/data/18"
rm -Rf "${baseFolder}/packages/backend/drizzle/"*

sleep 8s

# Start Docker containers
echo "Starting Postgres docker container"
docker compose -f "$baseFolder/docker/docker-compose-pg.yml" up -d

# change $backend/src/db/schema files
# Comment line 4
sed -i '4s/^/\/\//' ${adminSchemaFile}
sed -i '4s/^/\/\//' ${usersSchemaFile}
# Uncomment line 5
sed -i '5s/^\/\///' ${adminSchemaFile}
sed -i '5s/^\/\///' ${usersSchemaFile}

# Run drizzle-kit generate
echo "Running: pnpm run generate"
pnpm run generate

# Find the SQL file in the backend directory
echo "Finding drizzle generated sql file"
sqlFile=$(find "${backend}" -type f -name "*.sql" | head -n 1)

# Check if SQL file was found
if [[ -z "$sqlFile" ]]; then
  echo "Error: No .sql file found in ${backend}"
  exit 1
fi

# Check if multiple SQL files exist (optional warning)
sqlFileCount=$(find "${backend}/drizzle" -type f -name "*.sql" | wc -l)
if [[ $sqlFileCount -gt 1 ]]; then
  echo "Warning: Multiple .sql files found."
fi
echo "Using ${sqlFile}"

# Combine SQL files
echo "Updating drizzle migration file"
sed -i '1i\
CREATE SCHEMA IF NOT EXISTS "admin";\
CREATE SCHEMA IF NOT EXISTS "user";' "${sqlFile}"

sleep 8s

# Run drizzle-kit migrations
echo "Running: pnpm run migrate"
pnpm run migrate

# Start studio in background
# echo "Running: pnpm run studio &"
# pnpm run studio &
# jobs -p > "${baseFolder}/scripts/studio.pid"

sleep 8s

# change $backend/src/db/schema files
# Comment line 5
sed -i '5s/^/\/\//' ${adminSchemaFile}
sed -i '5s/^/\/\//' ${usersSchemaFile}
# Uncomment line 4
sed -i '4s/^\/\///' ${adminSchemaFile}
sed -i '4s/^\/\///' ${usersSchemaFile}

cd "${baseFolder}/scripts"
