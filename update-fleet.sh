#!/usr/bin/env bash
# update-fleet.sh — roll a release across all GPT instances on this host.
#
#   ./update-fleet.sh                 deploy origin/main to every instance
#   ./update-fleet.sh v1.4.0          deploy a tag/branch everywhere
#   ./update-fleet.sh main lagos      deploy to one instance only
#
# Per instance: git fetch/checkout → apply pending migrations → rebuild api →
# health check. An instance failing any step is reported and skipped; others
# continue. Exit 1 if any instance failed.
#
set -uo pipefail

REF="${1:-main}"
ONLY="${2:-}"
FAILED=()

instances() {
  for marker in /opt/*/.gpt-instance; do
    [ -f "$marker" ] || continue
    dir=$(dirname "$marker")
    slug=$(basename "$dir")
    [ -n "$ONLY" ] && [ "$slug" != "$ONLY" ] && continue
    echo "$dir"
  done
}

for dir in $(instances); do
  slug=$(basename "$dir")
  echo "==> $slug ($dir)"

  set -a; . "$dir/.env"; set +a   # STACK_PREFIX, POSTGRES_*, API_PORT, COMPOSE_PROJECT_NAME
  PREFIX="${STACK_PREFIX:-$slug}"

  # --- code ---
  if ! git -C "$dir" fetch --depth 1 origin "$REF" 2>&1 | tail -1; then
    echo "    FAIL: git fetch"; FAILED+=("$slug"); continue
  fi
  git -C "$dir" checkout -q FETCH_HEAD || { echo "    FAIL: git checkout $REF"; FAILED+=("$slug"); continue; }
  echo "    code: $(git -C "$dir" rev-parse --short HEAD)"

  # --- migrations (ledger-tracked, applied in filename order) ---
  ledger="$dir/.migrations-applied"; touch "$ledger"
  mfail=0
  for m in "$dir"/backend/migrations/*.sql; do
    name=$(basename "$m")
    grep -qx "$name" "$ledger" && continue
    echo "    migrating: $name"
    if docker exec -i "$PREFIX-db" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 < "$m" >/dev/null 2>&1; then
      echo "$name" >> "$ledger"
    else
      echo "    FAIL: migration $name"; mfail=1; break
    fi
  done
  [ "$mfail" = 1 ] && { FAILED+=("$slug"); continue; }

  # --- rebuild api (db is untouched) ---
  (cd "$dir" && docker compose up -d --build api >/dev/null 2>&1) \
    || { echo "    FAIL: docker compose build"; FAILED+=("$slug"); continue; }

  # --- health ---
  ok=0
  for i in $(seq 1 45); do
    curl -sf "http://127.0.0.1:$API_PORT/health" >/dev/null && { ok=1; break; }
    sleep 2
  done
  if [ "$ok" = 1 ]; then
    echo "    healthy on :$API_PORT"
  else
    echo "    FAIL: health check timed out — docker logs $PREFIX-api"
    FAILED+=("$slug")
  fi
done

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "Fleet update complete — all instances healthy."
else
  echo "FAILED instances: ${FAILED[*]}"
  exit 1
fi
