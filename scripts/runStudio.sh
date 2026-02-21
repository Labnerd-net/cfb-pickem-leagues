#!/bin/bash
set -euo pipefail  # Exit on error, undefined variables, and pipe failures

baseFolder="/home/bladner/Documents/programming/cfb-pickem"
backend="${baseFolder}/packages/backend"
adminSchemaFile="${backend}/src/db/schema/admin.ts"
usersSchemaFile="${backend}/src/db/schema/users.ts"

cd "${backend}"

# change $backend/src/db/schema files
# Comment line
sed -i '15s/^/\/\//' ${adminSchemaFile}
sed -i '12s/^/\/\//' ${usersSchemaFile}
sed -i '14s/^/\/\//' ${usersSchemaFile}
# Uncomment line
sed -i '16s/^\/\///' ${adminSchemaFile}
sed -i '13s/^\/\///' ${usersSchemaFile}
sed -i '15s/^\/\///' ${usersSchemaFile}

# Start studio in background
echo "Running: pnpm run studio &"
pnpm run studio
