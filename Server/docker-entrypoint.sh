#!/usr/bin/env bash
set -euo pipefail

export PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-wanderline}"
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-4000}"
export STORAGE_MODE="${STORAGE_MODE:-postgres}"
export NODE_ENV="${NODE_ENV:-production}"

PG_BIN="$(ls -d /usr/lib/postgresql/*/bin | head -n1)"
export PATH="$PG_BIN:$PATH"

mkdir -p "$PGDATA" /var/run/postgresql
chown -R postgres:postgres "$PGDATA" /var/run/postgresql

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] Initializing Postgres in $PGDATA"
  su -s /bin/bash postgres -c "$PG_BIN/initdb -D '$PGDATA' --auth-local=trust --auth-host=md5 --username='$POSTGRES_USER'"
  cat >> "$PGDATA/postgresql.conf" <<CONF
listen_addresses = '127.0.0.1'
port = 5432
shared_buffers = 32MB
work_mem = 4MB
maintenance_work_mem = 32MB
max_connections = 20
effective_cache_size = 64MB
wal_level = minimal
max_wal_senders = 0
checkpoint_completion_target = 0.9
CONF
  cat > "$PGDATA/pg_hba.conf" <<HBA
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
HBA
  chown postgres:postgres "$PGDATA/postgresql.conf" "$PGDATA/pg_hba.conf"
fi

echo "[entrypoint] Starting Postgres"
su -s /bin/bash postgres -c "$PG_BIN/postgres -D '$PGDATA'" &
PG_PID=$!

cleanup() {
  echo "[entrypoint] Stopping Postgres (pid $PG_PID)"
  kill -TERM "$PG_PID" 2>/dev/null || true
  wait "$PG_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[entrypoint] Waiting for Postgres"
for i in $(seq 1 60); do
  if pg_isready -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "[entrypoint] Postgres failed to become ready" >&2
    exit 1
  fi
done

su -s /bin/bash postgres -c "psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U '$POSTGRES_USER' -d postgres" <<SQL
DO \$\$
BEGIN
  EXECUTE format('ALTER USER %I WITH PASSWORD %L', '$POSTGRES_USER', '$POSTGRES_PASSWORD');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
\$\$;
SQL

DB_EXISTS=$(su -s /bin/bash postgres -c "psql -h 127.0.0.1 -U '$POSTGRES_USER' -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'\"" | tr -d '[:space:]')
if [ "$DB_EXISTS" != "1" ]; then
  echo "[entrypoint] Creating database $POSTGRES_DB"
  su -s /bin/bash postgres -c "$PG_BIN/createdb -h 127.0.0.1 -U '$POSTGRES_USER' '$POSTGRES_DB'"
fi

cd /app/Server
echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] Starting Nest on ${HOST}:${PORT}"
exec node dist/main.js
