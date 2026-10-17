#!/usr/bin/env bash
#
# provision.sh — spin up a new isolated client instance of GPT on this VPS.
#
# Each client gets: a git checkout at /opt/<slug>, generated secrets in .env,
# a docker compose project (<slug>-api + <slug>-db), an nginx vhost on its own
# domain, TLS via certbot, and a daily pg_dump cron job.
#
# Usage:
#   sudo ./provision.sh <slug> <domain> [options]
#
#   slug    lowercase identifier — used for /opt/<slug>, container names, port file
#   domain  public hostname for the API, e.g. api.client2.example.gov
#
# Options:
#   --name "Display Name"        INSTANCE_NAME (default: Government Project Tracker)
#   --admin-email EMAIL          initial admin login (required)
#   --admin-password PASS        initial admin password (default: random, printed once)
#   --area-label LABEL           e.g. "LGA", "District", "County" (default: Area)
#   --area-plural LABEL          (default: area label + "s")
#   --currency SYMBOL            e.g. "₦", "$", "KSh" (default: ₦)
#   --brand-color HEX            e.g. "#0e7490"
#   --sidebar-color HEX          optional darker sidebar tone
#   --contact-email EMAIL        shown in the public footer
#   --footer-org NAME            © line (default: same as --name)
#   --logo-url URL               remote logo (or upload later via PUT /api/instance)
#   --cors-origin ORIGIN         frontend origin (required, e.g. https://client2.vercel.app)
#   --git-ref REF                branch/tag to deploy (default: main)
#   --repo URL                   git remote (default: this checkout's origin)
#   --smtp-host/--smtp-user/--smtp-pass/--smtp-from   mail for password resets
#   --no-tls                     skip certbot (bring your own cert later)
#   --dry-run                    print the plan, change nothing
#
set -euo pipefail

# ---------- args ----------
SLUG="${1:-}"; DOMAIN="${2:-}"
[ $# -ge 2 ] && shift 2 || { sed -n '2,30p' "$0"; exit 1; }

INSTANCE_NAME="Government Project Tracker"
ADMIN_EMAIL="" ADMIN_PASSWORD=""
AREA_LABEL="Area" AREA_PLURAL="" CURRENCY="₦"
BRAND_COLOR="" SIDEBAR_COLOR="" CONTACT_EMAIL="" FOOTER_ORG="" LOGO_URL=""
CORS_ORIGIN="" GIT_REF="main" REPO_URL=""
SMTP_HOST="" SMTP_USER="" SMTP_PASS="" SMTP_FROM=""
TLS=1 DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --name) INSTANCE_NAME="$2";;
    --admin-email) ADMIN_EMAIL="$2";;
    --admin-password) ADMIN_PASSWORD="$2";;
    --area-label) AREA_LABEL="$2";;
    --area-plural) AREA_PLURAL="$2";;
    --currency) CURRENCY="$2";;
    --brand-color) BRAND_COLOR="$2";;
    --sidebar-color) SIDEBAR_COLOR="$2";;
    --contact-email) CONTACT_EMAIL="$2";;
    --footer-org) FOOTER_ORG="$2";;
    --logo-url) LOGO_URL="$2";;
    --cors-origin) CORS_ORIGIN="$2";;
    --git-ref) GIT_REF="$2";;
    --repo) REPO_URL="$2";;
    --smtp-host) SMTP_HOST="$2";;
    --smtp-user) SMTP_USER="$2";;
    --smtp-pass) SMTP_PASS="$2";;
    --smtp-from) SMTP_FROM="$2";;
    --no-tls) TLS=0; shift; continue;;
    --dry-run) DRY_RUN=1; shift; continue;;
    *) echo "Unknown option: $1" >&2; exit 1;;
  esac
  if [ $# -ge 2 ]; then shift 2; else shift; fi
done

# ---------- validate ----------
err() { echo "error: $*" >&2; exit 1; }
[ -n "$SLUG" ]   || err "slug required"
[ -n "$DOMAIN" ] || err "domain required"
echo "$SLUG" | grep -qE '^[a-z0-9][a-z0-9-]{1,30}$' || err "slug must be lowercase alphanumeric + dashes"
[ -n "$ADMIN_EMAIL" ] || err "--admin-email is required"
[ -n "$CORS_ORIGIN" ] || err "--cors-origin is required (the client's frontend URL)"
if [ -d "/opt/$SLUG" ]; then err "/opt/$SLUG already exists — pick another slug or remove it first"; fi
if [ "$DRY_RUN" = 0 ]; then
  command -v docker >/dev/null || err "docker not installed"
  command -v nginx  >/dev/null || err "nginx not installed"
  if [ "$TLS" = 1 ] && ! command -v certbot >/dev/null; then
    err "certbot not installed (or use --no-tls)"
  fi
fi

rand() { openssl rand -base64 "$(( $1 * 2 ))" 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c "$1" \
        || head -c 128 /dev/urandom | od -An -tx1 | tr -d ' \n' | head -c "$1"; }

AREA_PLURAL="${AREA_PLURAL:-${AREA_LABEL}s}"
FOOTER_ORG="${FOOTER_ORG:-$INSTANCE_NAME}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(rand 16)}"

# ---------- port allocation ----------
# API ports live in a registry file so two provisions can't collide.
PORT_FILE=/opt/.gpt-ports
touch "$PORT_FILE" 2>/dev/null || PORT_FILE=/tmp/.gpt-ports
API_PORT=5060
while grep -qs "^$API_PORT " "$PORT_FILE" || ss -ltn | grep -q ":$API_PORT "; do
  API_PORT=$((API_PORT + 1))
done

POSTGRES_PASSWORD="$(rand 32)"
JWT_SECRET="$(rand 48)"
SEED_KEY="$(rand 24)"
DB_NAME="$(echo "$SLUG" | tr -d '-')_db"

DIR="/opt/$SLUG"
REPO_URL="${REPO_URL:-$(git -C "$(dirname "$0")" config --get remote.origin.url 2>/dev/null || true)}"
[ -n "$REPO_URL" ] || err "could not detect repo URL — pass --repo https://github.com/you/gpt.git"

cat <<EOF
==> Provisioning plan
    slug:        $SLUG        domain:  $DOMAIN
    dir:         $DIR         api port: 127.0.0.1:$API_PORT
    name:        $INSTANCE_NAME
    admin:       $ADMIN_EMAIL
    cors:        $CORS_ORIGIN
    tls:         $([ $TLS = 1 ] && echo yes || echo no)
EOF
[ "$DRY_RUN" = 1 ] && { echo "dry-run — nothing changed"; exit 0; }

# ---------- code checkout ----------
echo "==> Cloning $REPO_URL ($GIT_REF) into $DIR"
git clone --depth 1 --branch "$GIT_REF" "$REPO_URL" "$DIR"
mkdir -p "$DIR/backups"

# ---------- env ----------
cat > "$DIR/.env" <<EOF
# Generated by provision.sh on $(date -u +%FT%TZ) — keep secret, never commit.
STACK_PREFIX=$SLUG
COMPOSE_PROJECT_NAME=$SLUG
API_PORT=$API_PORT
API_BIND=127.0.0.1

POSTGRES_DB=$DB_NAME
POSTGRES_USER=${SLUG//-/_}_user
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
CORS_ORIGIN=$CORS_ORIGIN
SOCKET_CORS_ORIGIN=$CORS_ORIGIN
SEED_KEY=$SEED_KEY

ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD

INSTANCE_NAME=$INSTANCE_NAME
INSTANCE_LOGO_URL=$LOGO_URL
INSTANCE_BRAND_COLOR=$BRAND_COLOR
INSTANCE_SIDEBAR_COLOR=$SIDEBAR_COLOR
INSTANCE_CURRENCY=$CURRENCY
INSTANCE_AREA_LABEL=$AREA_LABEL
INSTANCE_AREA_LABEL_PLURAL=$AREA_PLURAL
INSTANCE_CONTACT_EMAIL=$CONTACT_EMAIL
INSTANCE_FOOTER_ORG=$FOOTER_ORG

SMTP_HOST=$SMTP_HOST
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM
FRONTEND_URL=$CORS_ORIGIN
EOF
chmod 600 "$DIR/.env"

# ---------- containers ----------
echo "==> Building and starting $SLUG-db + $SLUG-api"
cd "$DIR"
docker compose -p "$SLUG" up -d --build

echo "==> Waiting for API health on :$API_PORT"
for i in $(seq 1 60); do
  curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null && break
  [ "$i" = 60 ] && err "API did not become healthy — check: docker logs $SLUG-api"
  sleep 2
done

# ---------- nginx ----------
NGINX_AVAIL=/etc/nginx/sites-available/$SLUG
cat > "$NGINX_AVAIL" <<EOF
# $SLUG — $INSTANCE_NAME API
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
    }
}
EOF
ln -sf "$NGINX_AVAIL" "/etc/nginx/sites-enabled/$SLUG"
nginx -t && systemctl reload nginx
echo "==> nginx vhost live: $DOMAIN -> 127.0.0.1:$API_PORT"

# ---------- TLS ----------
if [ "$TLS" = 1 ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CONTACT_EMAIL" ${CONTACT_EMAIL:+} 2>/dev/null \
    || certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
  systemctl reload nginx
  echo "==> TLS issued for $DOMAIN"
fi

# ---------- backups ----------
cat > "/etc/cron.d/$SLUG-backup" <<EOF
# Daily pg_dump for $SLUG, 14-day retention
15 3 * * * root docker exec $SLUG-db pg_dump -U ${SLUG//-/_}_user $DB_NAME | gzip > $DIR/backups/$DB_NAME-\$(date +\%F).sql.gz && find $DIR/backups -name '*.sql.gz' -mtime +14 -delete
EOF
echo "==> Daily backup cron installed (03:15 UTC, 14-day retention, $DIR/backups)"

# ---------- done ----------
echo "$API_PORT $SLUG" >> "$PORT_FILE"
cat <<EOF

==> Instance "$SLUG" is live
    API:      http://$DOMAIN/api/health  (https once certbot finishes)
    Admin:    $ADMIN_EMAIL / $ADMIN_PASSWORD
    Stack:    docker compose -p $SLUG  (dir: $DIR)

Next steps:
  1. Point the client's frontend at this API (VITE_API_URL=https://$DOMAIN/api)
  2. Log in as admin and PUT /api/instance to set logo/branding, or edit $DIR/.env
  3. Configure SMTP in $DIR/.env for password-reset email
  4. Consider offsite backup sync for $DIR/backups
EOF
