#!/bin/bash
set -euo pipefail  # Exit on error, undefined variables, and pipe failures

baseFolder="$(git rev-parse --show-toplevel)"
backend="${baseFolder}/packages/backend"
adminSchemaFile="${backend}/src/db/schema/admin.ts"
usersSchemaFile="${backend}/src/db/schema/users.ts"

cd "${backend}"

# change $backend/src/db/schema files
# Comment line
sed -i '16s/^/\/\//' ${adminSchemaFile}
sed -i '14s/^/\/\//' ${usersSchemaFile}
sed -i '16s/^/\/\//' ${usersSchemaFile}
# Uncomment line
sed -i '17s/^\/\///' ${adminSchemaFile}
sed -i '15s/^\/\///' ${usersSchemaFile}
sed -i '17s/^\/\///' ${usersSchemaFile}

# Start studio in background
echo "Running: pnpm run studio &"
pnpm run studio
