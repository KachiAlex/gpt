#!/usr/bin/env bash
# restore-backup.sh — restore a pg_dump into an instance's database.
#
#   ./restore-backup.sh lagos /opt/lagos/backups/lagos_db-2026-03-22.sql.gz
#
# DESTRUCTIVE: drops the instance's public schema and reloads it from the
# dump. The API is stopped during the restore and restarted after.
# Requires typing the slug to confirm.
#
set -euo pipefail

SLUG="${1:-}"; FILE="${2:-}"
[ -n "$SLUG" ] && [ -n "$FILE" ] || { sed -n '2,9p' "$0"; exit 1; }
DIR="/opt/$SLUG"
[ -f "$DIR/.gpt-instance" ] || { echo "error: $DIR is not a GPT instance" >&2; exit 1; }
[ -f "$FILE" ] || { echo "error: dump not found: $FILE" >&2; exit 1; }

set -a; . "$DIR/.env"; set +a
PREFIX="${STACK_PREFIX:-$SLUG}"

echo "==> About to DESTROY and rebuild $POSTGRES_DB from:"
echo "    $FILE ($(du -h "$FILE" | cut -f1))"
read -r -p "Type the slug '$SLUG' to confirm: " CONFIRM
[ "$CONFIRM" = "$SLUG" ] || { echo "aborted"; exit 1; }

echo "==> Stopping $PREFIX-api"
docker stop "$PREFIX-api" >/dev/null

echo "==> Dropping and recreating schema"
docker exec "$PREFIX-db" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "==> Restoring dump"
gunzip -c "$FILE" | docker exec -i "$PREFIX-db" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q

echo "==> Restarting $PREFIX-api"
docker start "$PREFIX-api" >/dev/null
for i in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$API_PORT/health" >/dev/null && break
  sleep 2
done

echo "==> Restore complete — verify data before resuming service"
