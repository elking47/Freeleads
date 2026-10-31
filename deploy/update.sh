#!/usr/bin/env bash
# Freeleads: deploy the latest code from GitHub on a VPS set up with deploy/setup-vps.sh.
#   sudo freeleads-update
# Backs up the database, pulls the code, reinstalls dependencies, restarts and checks the app.
set -Eeuo pipefail

main() {
  local APP_DIR="/opt/freeleads" NODE_DIR="/opt/freeleads-node"
  local ENV_FILE="/etc/freeleads/freeleads.env" DEPLOY_CONF="/etc/freeleads/deploy.conf"

  [[ $EUID -eq 0 ]] || { echo "Run with sudo." >&2; exit 1; }
  [[ -f $DEPLOY_CONF && -f $ENV_FILE ]] || { echo "Run deploy/setup-vps.sh first." >&2; exit 1; }

  local BRANCH PORT
  BRANCH="$(sed -n 's/^BRANCH=//p' "$DEPLOY_CONF")"
  PORT="$(sed -n 's/^PORT=//p' "$ENV_FILE")"
  export PATH="$NODE_DIR/bin:$PATH"

  echo "==> Backing up the database"
  /bin/bash "$APP_DIR/deploy/backup.sh"

  echo "==> Fetching branch $BRANCH"
  local before
  before="$(git -C "$APP_DIR" rev-parse --short HEAD)"
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard FETCH_HEAD
  chown -R root:root "$APP_DIR"
  echo "    $before -> $(git -C "$APP_DIR" log -1 --format='%h %s')"

  echo "==> Installing dependencies"
  (cd "$APP_DIR" && npm ci --omit=dev --no-audit --no-fund)

  echo "==> Restarting"
  systemctl restart freeleads
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then
      echo "Freeleads is up to date and running."
      return 0
    fi
    sleep 1
  done
  journalctl -u freeleads -n 40 --no-pager || true
  echo "The app did not come back up. Roll back with:" >&2
  echo "  sudo git -C $APP_DIR fetch --depth 1 origin $before && sudo git -C $APP_DIR reset --hard FETCH_HEAD && sudo systemctl restart freeleads" >&2
  exit 1
}

# Wrapped in main() so bash has read the whole script before git replaces this file.
main "$@"
