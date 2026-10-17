#!/usr/bin/env bash
# Deploy the Government Project Tracker backend to the VPS.
# Run ON the VPS inside the project directory (after copying the repo or git pull).
#
#   ./deploy-vps.sh            # build + start containers
#   ./deploy-vps.sh --seed     # also create the admin user afterwards
#
# Required env vars (put them in .env next to docker-compose.yml or export them):
#   POSTGRES_PASSWORD   - database password
#   JWT_SECRET          - JWT signing secret
# Optional:
#   POSTGRES_DB, POSTGRES_USER, API_PORT, CORS_ORIGIN,
#   SEED_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME

set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed." >&2
  exit 1
fi

COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

# Create .env from example if missing
if [ ! -f .env ]; then
  if [ -f env.example ]; then
    echo "No .env found - creating from env.example. EDIT .env and re-run."
    cp env.example .env
    exit 1
  fi
  echo "ERROR: no .env file found." >&2
  exit 1
fi

# Load env so ${VAR:?} checks in compose work
set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}"
: "${JWT_SECRET:?Set JWT_SECRET in .env}"

echo "==> Building and starting containers..."
$COMPOSE up -d --build

echo "==> Waiting for API health check..."
ATTEMPTS=0
until curl -fsS "http://localhost:${API_PORT:-5000}/health" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge 30 ]; then
    echo "ERROR: API did not become healthy in time. Check '$COMPOSE logs api'." >&2
    exit 1
  fi
  sleep 2
done

echo "==> API is healthy:"
curl -fsS "http://localhost:${API_PORT:-5000}/health"
echo

if [ "${1:-}" = "--seed" ]; then
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    echo "WARNING: ADMIN_PASSWORD not set - skipping admin creation." >&2
  else
    echo "==> Creating admin user (${ADMIN_EMAIL:-admin@abia.gov.ng})..."
    $COMPOSE exec -T api node dist/scripts/create-admin-user.js \
      "${ADMIN_EMAIL:-admin@abia.gov.ng}" \
      "${ADMIN_PASSWORD}" \
      "${ADMIN_FIRST_NAME:-Government}" \
      "${ADMIN_LAST_NAME:-Administrator}" || {
        echo "WARNING: admin creation failed (user may already exist)." >&2
      }
  fi
fi

echo "==> Done. API listening on port ${API_PORT:-5000}."
