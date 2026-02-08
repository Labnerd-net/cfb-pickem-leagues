#!/bin/bash
set -euo pipefail  # Exit on error, undefined variables, and pipe failures

baseFolder="/home/bladner/Documents/programming/cfb-pickem"
backend="${baseFolder}/packages/backend"
adminSchemaFile="${backend}/src/db/schema/admin.ts"
usersSchemaFile="${backend}/src/db/schema/users.ts"

# change $backend/src/db/schema files
# Comment line 5
sed -i '5s/^/\/\//' ${adminSchemaFile}
sed -i '5s/^/\/\//' ${usersSchemaFile}
# Uncomment line 4
sed -i '4s/^\/\///' ${adminSchemaFile}
sed -i '4s/^\/\///' ${usersSchemaFile}
