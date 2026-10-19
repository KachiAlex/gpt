#!/usr/bin/env bash
# backup-db.sh — verified nightly pg_dump for one GPT instance.
#
# Installed by provision.sh into /etc/cron.d/<slug>-backup:
#   15 3 * * * root /opt/<slug>/backup-db.sh >> /opt/<slug>/backups/backup.log 2>&1
#
# Unlike a bare `pg_dump | gzip` cron line this: checks pg_dump's exit code,
# verifies the archive, writes to a temp name then atomically renames, keeps
# dumps private (umask 077 / backups dir 700), and only prunes old dumps after
# a new one is confirmed good.
#
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SLUG="$(basename "$DIR")"
[ -f "$DIR/.gpt-instance" ] || { echo "$SLUG: not a GPT instance dir" >&2; exit 1; }

# Subshell so sourced env can't leak if this script is ever reused.
(
  set -a; . "$DIR/.env"; set +a
  PREFIX="${STACK_PREFIX:-$SLUG}"
  BACKUPS="$DIR/backups"
  mkdir -p "$BACKUPS" && chmod 700 "$BACKUPS"
  umask 077

  STAMP="$(date +%F-%H%M%S)"
  OUT="$BACKUPS/${POSTGRES_DB}-${STAMP}.sql.gz"
  TMP="$BACKUPS/.dump-${STAMP}.sql"

  fail() { echo "$(date -Is) $SLUG: BACKUP FAILED — $1" >&2; rm -f "$TMP" "$TMP.gz"; exit 1; }

  # pg_dump exit status checked explicitly — no pipe masking
  docker exec "$PREFIX-db" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$TMP" \
    || fail "pg_dump exited non-zero (is $PREFIX-db healthy?)"

  [ -s "$TMP" ] || fail "pg_dump produced empty output"
  gzip -f "$TMP" || fail "gzip failed"
  gzip -t "$TMP.gz" || fail "archive failed gzip -t"
  mv "$TMP.gz" "$OUT"

  # Only now, with a verified new dump in place, prune old ones (14-day local retention)
  find "$BACKUPS" -name '*.sql.gz' -mtime +14 -delete

  echo "$(date -Is) $SLUG: backup OK -> $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"
)
