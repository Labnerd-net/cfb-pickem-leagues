#!/bin/sh
set -e

# Generate nginx config from template, substituting BACKEND_URL.
# Passing the variable list explicitly prevents nginx vars like $host from being touched.
# This runs automatically before nginx starts (nginx:alpine /docker-entrypoint.d/ mechanism).

if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: BACKEND_URL is not set. API proxying will not work." >&2
  exit 0
fi

envsubst '${BACKEND_URL}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf
