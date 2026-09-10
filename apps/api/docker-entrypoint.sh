#!/bin/sh
# =============================================================================
# Waits for Postgres, applies migrations, then hands over to the app.
#
# `migrate deploy` is the only safe migration command for production: it applies
# pending migrations and nothing else. `migrate dev` can reset the database,
# which on a live server means deleting every booking.
# =============================================================================
set -e

> /tmp/db-probe.log

# Reports whether the database answers, writing the real driver error to a log
# rather than swallowing it. Hiding that error made a simple wrong password
# indistinguishable from a database that was merely slow to start.
probe_database() {
  node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`SELECT 1\`
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(String(error.message).split('\n').filter(Boolean).slice(0, 4).join(' | '));
    process.exit(1);
  });
" 2> /tmp/db-probe.log
}

# The URL is echoed with the password masked, because the single most common
# cause of this failing is DATABASE_URL disagreeing with POSTGRES_PASSWORD.
echo "[entrypoint] waiting for the database at $(echo "$DATABASE_URL" | sed -E 's#://([^:]+):[^@]*@#://\1:****@#')"

# Compose health checks cover the normal case, but a database can also be
# external or still replaying WAL, so block until it genuinely answers.
ATTEMPTS=0
until probe_database; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge 30 ]; then
    echo "[entrypoint] the database never became reachable. Last error:" >&2
    cat /tmp/db-probe.log >&2
    echo "" >&2
    echo "[entrypoint] Check that the password inside DATABASE_URL matches" >&2
    echo "             POSTGRES_PASSWORD exactly, and that the host is 'postgres'." >&2
    exit 1
  fi
  # Report progress rather than sitting silent for two minutes.
  if [ $((ATTEMPTS % 5)) -eq 0 ]; then
    echo "[entrypoint] still waiting (attempt $ATTEMPTS): $(tr -d '\n' < /tmp/db-probe.log)"
  fi
  sleep 2
done

echo "[entrypoint] database is up. Applying migrations…"
npx prisma migrate deploy

echo "[entrypoint] starting the API."
exec "$@"
