#!/usr/bin/env bash
#
# GPT uptime/health monitor — run from cron on each VPS instance.
#
# Checks, per instance:
#   * Docker container running (PREFIX-api)
#   * Local API  http://127.0.0.1:$API_PORT/health  (includes DB check)
#   * External API URL (optional, EXTERNAL_API_URL)
#   * Frontend URL (optional, FRONTEND_URL)
#   * Disk usage above DISK_WARN_PCT (default 85%)
#
# Alerts POST a JSON payload to ALERT_WEBHOOK_URL (Slack/Discord/generic
# webhook compatible: {"text": "...", "status": ..., "checks": ...}).
# A state file dedupes alerts: it fires on DOWN transitions and again
# every ALERT_REPEAT_MIN minutes while still down, plus a RECOVERED
# notice on the transition back up.
#
# Cron (every 5 min):
#   */5 * * * * /opt/gpt/health-monitor.sh >> /var/log/gpt-monitor.log 2>&1
#
# Env:
#   API_PORT=5055 PREFIX=gpt INSTANCE_NAME=vps1
#   EXTERNAL_API_URL=https://api.example.com   (optional)
#   FRONTEND_URL=https://gptapp.vercel.app     (optional)
#   ALERT_WEBHOOK_URL=https://hooks.slack.com/... (optional; skips alerting if unset)
#   DISK_WARN_PCT=85 ALERT_REPEAT_MIN=60

set -u

API_PORT="${API_PORT:-5055}"
PREFIX="${PREFIX:-gpt}"
INSTANCE_NAME="${INSTANCE_NAME:-$(hostname)}"
EXTERNAL_API_URL="${EXTERNAL_API_URL:-}"
FRONTEND_URL="${FRONTEND_URL:-}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
DISK_WARN_PCT="${DISK_WARN_PCT:-85}"
ALERT_REPEAT_MIN="${ALERT_REPEAT_MIN:-60}"
STATE_FILE="${STATE_FILE:-/tmp/.gpt-monitor-state}"

down=0
problems=()

# --- container running ---
if command -v docker >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' | grep -qx "${PREFIX}-api"; then
    down=1
    problems+=("container ${PREFIX}-api not running")
  fi
fi

# --- local health (DB-inclusive) ---
if [ "$down" -eq 0 ]; then
  if ! curl -sf -m 10 "http://127.0.0.1:${API_PORT}/health" >/dev/null; then
    down=1
    problems+=("local /health on :${API_PORT} failing")
  fi
fi

# --- external api ---
if [ -n "$EXTERNAL_API_URL" ]; then
  if ! curl -sf -m 15 "${EXTERNAL_API_URL%/}/health" >/dev/null; then
    down=1
    problems+=("external ${EXTERNAL_API_URL}/health failing")
  fi
fi

# --- frontend reachable ---
if [ -n "$FRONTEND_URL" ]; then
  if ! curl -sf -m 15 -o /dev/null "$FRONTEND_URL"; then
    down=1
    problems+=("frontend ${FRONTEND_URL} unreachable")
  fi
fi

# --- disk ---
disk_pct="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [ "${disk_pct:-0}" -ge "$DISK_WARN_PCT" ]; then
  down=1
  problems+=("disk usage ${disk_pct}% >= ${DISK_WARN_PCT}%")
fi

# --- state + alerting ---
now_epoch="$(date +%s)"
prev_state="$(cut -d' ' -f1 "$STATE_FILE" 2>/dev/null || echo up)"
last_alert="$(cut -d' ' -f2 "$STATE_FILE" 2>/dev/null || echo 0)"

alert() { # $1 = status word, $2 = message
  local msg="[$INSTANCE_NAME] $2"
  echo "$(date -Iseconds) $msg"
  if [ -n "$ALERT_WEBHOOK_URL" ]; then
    curl -sf -m 10 -X POST "$ALERT_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"$msg\", \"status\": \"$1\", \"instance\": \"$INSTANCE_NAME\"}" \
      >/dev/null || echo "  (webhook delivery failed)"
  fi
}

if [ "$down" -eq 1 ]; then
  detail="$(IFS='; '; echo "${problems[*]}")"
  repeat_sec=$((ALERT_REPEAT_MIN * 60))
  if [ "$prev_state" != "down" ] || [ $((now_epoch - last_alert)) -ge "$repeat_sec" ]; then
    alert "down" "DOWN: $detail"
    echo "down $now_epoch" > "$STATE_FILE"
  else
    echo "$(date -Iseconds) [$INSTANCE_NAME] still down: $detail"
    echo "down $last_alert" > "$STATE_FILE"
  fi
  exit 1
fi

if [ "$prev_state" = "down" ]; then
  alert "recovered" "RECOVERED: all checks passing"
fi
echo "up $now_epoch" > "$STATE_FILE"
echo "$(date -Iseconds) [$INSTANCE_NAME] OK (disk ${disk_pct}%)"
