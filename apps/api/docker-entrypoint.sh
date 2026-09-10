#!/bin/sh
# =============================================================================
# Waits for Postgres, applies migrations, then hands over to the app.
#
# `migrate deploy` is the only safe migration command for production: it applies
# pending migrations and nothing else. `migrate dev` can reset the database,
# which on a live server means deleting every booking.
# =============================================================================
set -e

echo "[entrypoint] waiting for the database…"

# Compose health checks cover the normal case, but a database can also be
# external or still replaying WAL, so block until it genuinely answers.
ATTEMPTS=0
until node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1));
" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge 60 ]; then
    echo "[entrypoint] database did not become reachable after 60 attempts — giving up." >&2
    exit 1
  fi
  sleep 2
done

echo "[entrypoint] database is up. Applying migrations…"
npx prisma migrate deploy

echo "[entrypoint] starting the API."
exec "$@"
