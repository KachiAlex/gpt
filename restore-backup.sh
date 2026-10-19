#!/usr/bin/env bash
# restore-backup.sh — restore a pg_dump into an instance's database.
#
#   ./restore-backup.sh lagos /opt/lagos/backups/lagos_db-2026-03-22.sql.gz
#
# DESTRUCTIVE: drops the instance's public schema and reloads it from the
# dump. Guards: archive integrity check, a pre-restore safety dump, a single
# transaction for the reload, and a trap that always restarts the API.
# Requires typing the slug to confirm.
#
set -euo pipefail

SLUG="${1:-}"; FILE="${2:-}"
[ -n "$SLUG" ] && [ -n "$FILE" ] || { sed -n '2,12p' "$0"; exit 1; }
DIR="/opt/$SLUG"
[ -f "$DIR/.gpt-instance" ] || { echo "error: $DIR is not a GPT instance" >&2; exit 1; }
[ -f "$FILE" ] || { echo "error: dump not found: $FILE" >&2; exit 1; }

set -a; . "$DIR/.env"; set +a
PREFIX="${STACK_PREFIX:-$SLUG}"

# Verify the dump before touching the database
gzip -t "$FILE" || { echo "error: $FILE is not a valid gzip archive" >&2; exit 1; }
gunzip -c "$FILE" | head -50 | grep -q 'PostgreSQL' \
  || { echo "error: $FILE does not look like a PostgreSQL dump" >&2; exit 1; }

echo "==> About to DESTROY and rebuild $POSTGRES_DB from:"
echo "    $FILE ($(du -h "$FILE" | cut -f1))"
read -r -p "Type the slug '$SLUG' to confirm: " CONFIRM
[ "$CONFIRM" = "$SLUG" ] || { echo "aborted"; exit 1; }

# Safety net: snapshot the current DB before dropping it
SAFETY="$DIR/backups/pre-restore-$(date +%F-%H%M%S).sql.gz"
echo "==> Taking pre-restore safety dump -> $(basename "$SAFETY")"
umask 077
docker exec "$PREFIX-db" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$SAFETY" \
  || { echo "error: safety dump failed — aborting, nothing was changed" >&2; exit 1; }
gzip -t "$SAFETY" || { echo "error: safety dump failed verification — aborting" >&2; exit 1; }

echo "==> Stopping $PREFIX-api"
docker stop "$PREFIX-api" >/dev/null
# Whatever happens below, the API comes back up
trap 'docker start "$PREFIX-api" >/dev/null 2>&1 || true' EXIT

echo "==> Dropping and recreating schema"
docker exec "$PREFIX-db" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "==> Restoring dump (single transaction — all-or-nothing)"
gunzip -c "$FILE" | docker exec -i "$PREFIX-db" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -1 -q

echo "==> Restarting $PREFIX-api"
docker start "$PREFIX-api" >/dev/null
trap - EXIT

ok=0
for i in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$API_PORT/health" >/dev/null && { ok=1; break; }
  sleep 2
done
if [ "$ok" != 1 ]; then
  echo "error: API did not become healthy after restore — check: docker logs $PREFIX-api" >&2
  exit 1
fi

echo "==> Restore complete — verify data before resuming service"
