#!/usr/bin/env bash
# One-shot setup for the small-VPS backend (docker-compose.vps-small.yaml).
# Run as root, ideally inside tmux so a dropped SSH session does not stop it:
#   tmux new -s setup
#   curl -fsSL https://raw.githubusercontent.com/kyokuyo23/postiz-app/main/var/docker/vps-setup.sh | sudo bash
# Safe to re-run: it skips steps that are already done and never overwrites backend.env.
set -euo pipefail

DIR=/opt/postiz-app
REPO=https://github.com/kyokuyo23/postiz-app.git

echo "==> 1/5 Swap (6 GB total; the TypeScript build needs ~3 GB)"
if ! swapon --show | grep -q '/swapfile '; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
if ! swapon --show | grep -q '/swapfile2'; then
  fallocate -l 2G /swapfile2 && chmod 600 /swapfile2 && mkswap /swapfile2 && swapon /swapfile2
  grep -q '^/swapfile2 ' /etc/fstab || echo '/swapfile2 none swap sw 0 0' >> /etc/fstab
fi
free -h

echo "==> 2/5 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
id ubuntu >/dev/null 2>&1 && usermod -aG docker ubuntu || true

echo "==> 3/5 Code"
# A clone interrupted by a dropped connection leaves a broken repo: start over.
if [ -d "$DIR" ] && ! git -C "$DIR" rev-parse --verify -q HEAD >/dev/null 2>&1; then
  rm -rf "$DIR"
fi
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"

echo "==> 4/5 Build image (this takes 20-40 minutes)"
docker build -f Dockerfile.backend -t postiz-backend:local .

echo "==> 5/5 Configure and start"
if [ ! -f backend.env ]; then
  cp backend.env.example backend.env
  sed -i "s/^JWT_SECRET=$/JWT_SECRET=$(openssl rand -hex 32)/" backend.env
  sed -i "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" backend.env
  sed -i "s/^TEMPORAL_DB_PASSWORD=$/TEMPORAL_DB_PASSWORD=$(openssl rand -hex 24)/" backend.env
  chmod 600 backend.env
fi
docker compose -f docker-compose.vps-small.yaml --env-file backend.env up -d

echo
echo "Done. Containers:"
docker compose -f docker-compose.vps-small.yaml --env-file backend.env ps
echo
echo "Logs:  cd $DIR && sudo docker compose -f docker-compose.vps-small.yaml --env-file backend.env logs -f postiz"
echo "Check: https://\$(grep ^API_DOMAIN backend.env | cut -d= -f2)/  should show 'Postiz API'"
