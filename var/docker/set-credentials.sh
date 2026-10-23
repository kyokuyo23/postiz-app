#!/usr/bin/env bash
# Interactively store social-platform app credentials in backend.env and
# restart the backend. Press Enter to skip a platform (existing values are kept).
# Secrets are read without echo and never printed.
#
# Run on the VPS:
#   curl -fsSL https://raw.githubusercontent.com/kyokuyo23/postiz-app/main/var/docker/set-credentials.sh | sudo bash
set -euo pipefail

DIR=/opt/postiz-app
F="$DIR/backend.env"
[ -f "$F" ] || { echo "backend.env not found in $DIR. Run vps-setup.sh first."; exit 1; }

# Prompts must read from the terminal even when the script is piped into bash.
exec 3</dev/tty

set_kv() {
  local k="$1" v="$2"
  if grep -q "^${k}=" "$F"; then
    K="$k" V="$v" awk 'BEGIN{FS=OFS="="} $1==ENVIRON["K"]{print ENVIRON["K"] "=" ENVIRON["V"]; next} {print}' "$F" > "$F.tmp"
    cat "$F.tmp" > "$F"
    rm -f "$F.tmp"
  else
    printf '%s=%s\n' "$k" "$v" >> "$F"
  fi
}

CHANGED=()
ask_pair() {
  local label="$1" id_key="$2" secret_key="$3" id secret
  echo
  echo "== $label  (Enter to skip)"
  read -r -u 3 -p "   $id_key: " id
  [ -z "$id" ] && { echo "   skipped"; return; }
  read -r -s -u 3 -p "   $secret_key (hidden): " secret
  echo
  [ -z "$secret" ] && { echo "   secret empty, skipped"; return; }
  set_kv "$id_key" "$id"
  set_kv "$secret_key" "$secret"
  CHANGED+=("$label")
  echo "   saved (id length ${#id}, secret length ${#secret})"
}

echo "Redirect URI for every platform: https://<app domain>/integrations/social/<platform>"
ask_pair "YouTube"                    YOUTUBE_CLIENT_ID   YOUTUBE_CLIENT_SECRET
ask_pair "Threads"                    THREADS_APP_ID      THREADS_APP_SECRET
ask_pair "Facebook Page (+ Instagram Business via Facebook)" FACEBOOK_APP_ID FACEBOOK_APP_SECRET
ask_pair "Instagram (Instagram login)" INSTAGRAM_APP_ID   INSTAGRAM_APP_SECRET
ask_pair "TikTok"                     TIKTOK_CLIENT_ID    TIKTOK_CLIENT_SECRET
ask_pair "LinkedIn"                   LINKEDIN_CLIENT_ID  LINKEDIN_CLIENT_SECRET
ask_pair "X (Twitter)"                X_API_KEY           X_API_SECRET
ask_pair "Pinterest"                  PINTEREST_CLIENT_ID PINTEREST_CLIENT_SECRET

if [ ${#CHANGED[@]} -eq 0 ]; then
  echo; echo "Nothing changed."; exit 0
fi

echo
echo "Saved: ${CHANGED[*]}"
echo "Restarting backend..."
cd "$DIR"
docker compose -f docker-compose.vps-small.yaml --env-file backend.env up -d --force-recreate postiz
echo "Done. Wait 1-2 minutes, then use Add Channel in the app."
