#!/usr/bin/env bash
# Starts backend and orchestrator; if either exits, the container exits so
# Docker's restart policy brings both back.
# A watchdog also exits the container when the backend API stops answering
# (e.g. it hung during start-up on a low-memory VPS), so it recovers on its own.
set -e
cd /app

# Same schema sync the full image runs on start (pm2-run)
pnpm run prisma-db-push

pnpm --filter ./apps/backend run start &
pnpm --filter ./apps/orchestrator run start &

# Watchdog: after a grace period, probe the API every minute; three failures
# in a row end the container. Any HTTP response (even 401/404) counts as alive.
GRACE="${WATCHDOG_GRACE_SECONDS:-600}"
(
  sleep "$GRACE"
  fails=0
  while true; do
    if node -e "fetch('http://127.0.0.1:3000/',{signal:AbortSignal.timeout(15000)}).then(()=>process.exit(0),()=>process.exit(1))"; then
      fails=0
    else
      fails=$((fails + 1))
      echo "[watchdog] backend API not answering ($fails/3)"
      if [ "$fails" -ge 3 ]; then
        echo "[watchdog] restarting container"
        exit 1
      fi
    fi
    sleep 60
  done
) &

wait -n
exit $?
