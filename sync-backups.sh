#!/usr/bin/env bash
# sync-backups.sh — push each instance's pg_dumps to S3-compatible storage
# (AWS S3, Cloudflare R2, Backblaze B2, MinIO…).
#
#   ./sync-backups.sh           sync every instance that has BACKUP_S3_* set
#   ./sync-backups.sh lagos     one instance only
#
# Per-instance .env keys (all required to activate):
#   BACKUP_S3_BUCKET     bucket name (path: <slug>/file.sql.gz)
#   BACKUP_S3_ENDPOINT   e.g. https://<acct>.r2.cloudflarestorage.com
#                        (omit for AWS; set AWS_REGION instead if needed)
#   BACKUP_S3_ACCESS_KEY / BACKUP_S3_SECRET_KEY
#   BACKUP_S3_REGION     optional, default auto
#
# Requires `aws` CLI or `rclone` on the host. No BACKUP_S3_* → instance skipped.
#
set -uo pipefail

ONLY="${1:-}"
SYNCED=0; SKIPPED=0; FAILED=0

have() { command -v "$1" >/dev/null 2>&1; }

sync_one() {
  dir="$1"; slug=$(basename "$dir")
  set -a; . "$dir/.env"; set +a

  [ -z "${BACKUP_S3_BUCKET:-}" ] && { echo "  $slug: no BACKUP_S3_BUCKET — skipped"; SKIPPED=$((SKIPPED+1)); return; }
  [ -z "${BACKUP_S3_ACCESS_KEY:-}" ] || [ -z "${BACKUP_S3_SECRET_KEY:-}" ] \
    && { echo "  $slug: incomplete BACKUP_S3_* keys — skipped"; SKIPPED=$((SKIPPED+1)); return; }
  [ -d "$dir/backups" ] || { echo "  $slug: no backups dir — skipped"; SKIPPED=$((SKIPPED+1)); return; }

  dest="s3://$BACKUP_S3_BUCKET/$slug"

  if have aws; then
    args=(s3 sync "$dir/backups/" "$dest" --exclude '*' --include '*.sql.gz')
    [ -n "${BACKUP_S3_ENDPOINT:-}" ] && args+=(--endpoint-url "$BACKUP_S3_ENDPOINT")
    [ -n "${BACKUP_S3_REGION:-}" ]   && args+=(--region "$BACKUP_S3_REGION")
    if AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
       aws "${args[@]}" >/dev/null 2>&1; then
      echo "  $slug: synced -> $dest"; SYNCED=$((SYNCED+1))
    else
      echo "  $slug: aws s3 sync FAILED"; FAILED=$((FAILED+1))
    fi
  elif have rclone; then
    if RCLONE_CONFIG_GPT_TYPE=s3 \
       RCLONE_CONFIG_GPT_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
       RCLONE_CONFIG_GPT_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
       RCLONE_CONFIG_GPT_ENDPOINT="${BACKUP_S3_ENDPOINT:-}" \
       RCLONE_CONFIG_GPT_REGION="${BACKUP_S3_REGION:-auto}" \
       rclone sync "$dir/backups/" "gpt:$BACKUP_S3_BUCKET/$slug" \
         --include '*.sql.gz' >/dev/null 2>&1; then
      echo "  $slug: synced -> $dest"; SYNCED=$((SYNCED+1))
    else
      echo "  $slug: rclone sync FAILED"; FAILED=$((FAILED+1))
    fi
  else
    echo "  $slug: neither aws CLI nor rclone installed — cannot sync"; FAILED=$((FAILED+1))
  fi
}

found=0
for marker in /opt/*/.gpt-instance; do
  [ -f "$marker" ] || continue
  dir=$(dirname "$marker")
  [ -n "$ONLY" ] && [ "$(basename "$dir")" != "$ONLY" ] && continue
  found=$((found+1))
  sync_one "$dir"
done

[ "$found" = 0 ] && echo "no GPT instances found"
echo "==> synced: $SYNCED  skipped: $SKIPPED  failed: $FAILED"
[ "$FAILED" -gt 0 ] && exit 1 || exit 0
