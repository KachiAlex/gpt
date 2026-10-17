#!/usr/bin/env bash
# fleet-status.sh — health snapshot of every GPT instance on this host.
#
#   ./fleet-status.sh            one-line status per instance
#   ./fleet-status.sh -v         + git commit, feature flags
#
set -uo pipefail
VERBOSE=0; [ "${1:-}" = "-v" ] && VERBOSE=1

printf "%-14s %-30s %-7s %-7s %-8s %s\n" SLUG DOMAIN DB API PORT NAME
for marker in /opt/*/.gpt-instance; do
  [ -f "$marker" ] || continue
  dir=$(dirname "$marker"); slug=$(basename "$dir")
  domain=$(grep -oP '(?<=^domain=).*' "$marker" 2>/dev/null || echo '?')

  set -a; . "$dir/.env" 2>/dev/null; set +a
  PREFIX="${STACK_PREFIX:-$slug}"; PORT="${API_PORT:-?}"

  db="down"; docker inspect -f '{{.State.Running}}' "$PREFIX-db" 2>/dev/null | grep -q true && db="up"
  api="down"
  name="-"
  if curl -sf --max-time 3 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    api="up"
    name=$(curl -sf --max-time 3 "http://127.0.0.1:$PORT/api/instance" \
      | grep -oP '(?<="name":")[^"]+' | head -1)
  fi
  printf "%-14s %-30s %-7s %-7s %-8s %s\n" "$slug" "$domain" "$db" "$api" "$PORT" "${name:--}"

  if [ "$VERBOSE" = 1 ]; then
    echo "    commit:   $(git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo '?') $(git -C "$dir" log -1 --format=%s 2>/dev/null | cut -c1-50)"
    echo "    backups:  $(ls "$dir"/backups/*.sql.gz 2>/dev/null | wc -l) files, newest: $(ls -t "$dir"/backups/*.sql.gz 2>/dev/null | head -1 | xargs -r basename)"
    echo "    features: $(grep -oP '(?<=^INSTANCE_FEATURES=).*' "$dir/.env" 2>/dev/null || echo '(default all-on)')"
  fi
done
