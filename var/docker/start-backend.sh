#!/usr/bin/env bash
# Starts backend and orchestrator; if either exits, the container exits so
# Docker's restart policy brings both back.
set -e
cd /app

# Same schema sync the full image runs on start (pm2-run)
pnpm run prisma-db-push

pnpm --filter ./apps/backend run start &
pnpm --filter ./apps/orchestrator run start &

wait -n
exit $?
