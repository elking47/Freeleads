#!/usr/bin/env bash
# Freeleads: one-command setup on an Ubuntu/Debian VPS (Hostinger or any other provider).
#
#   curl -fsSL https://raw.githubusercontent.com/elking47/Freeleads/main/deploy/setup-vps.sh -o setup-vps.sh
#   sudo bash setup-vps.sh --domain freeleads.fr --www --email you@example.com
#
# Safe to re-run: it updates the code and keeps the existing secret, port and database.
# It never changes the system-wide Node.js, other Nginx sites or other services (e.g. another app
# already hosted on the same VPS): Freeleads gets its own Node.js, user, port and Nginx site.
set -Eeuo pipefail

REPO_URL="https://github.com/elking47/Freeleads.git"
BRANCH="main"
DOMAIN=""
EMAIL=""
WITH_WWW=0
PORT=""
SKIP_TLS=0

APP_USER="freeleads"
APP_DIR="/opt/freeleads"
NODE_DIR="/opt/freeleads-node"
DATA_DIR="/var/lib/freeleads"
CONF_DIR="/etc/freeleads"
ENV_FILE="$CONF_DIR/freeleads.env"
DEPLOY_CONF="$CONF_DIR/deploy.conf"
BACKUP_DIR="/var/backups/freeleads"
UNIT_FILE="/etc/systemd/system/freeleads.service"
NGINX_SITE="/etc/nginx/sites-available/freeleads"

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARNING: %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: sudo bash setup-vps.sh --domain DOMAIN --email EMAIL [options]

Required:
  --domain DOMAIN   Domain or subdomain that points to this VPS (e.g. freeleads.fr, app.example.com)
  --email EMAIL     Email for Let's Encrypt (certificate expiry notices)

Options:
  --www             Also serve www.DOMAIN (its DNS record must point here too)
  --branch NAME     Git branch to deploy (default: main)
  --port N          Local port for the app (default: first free port from 3000)
  --skip-tls        Do not request an HTTPS certificate now (re-run later without this flag)
  -h, --help        Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --www) WITH_WWW=1; shift ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --skip-tls) SKIP_TLS=1; shift ;;
    -h | --help) usage; exit 0 ;;
    *) usage; die "Unknown option: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "Run this script as root (prefix it with sudo)."
DOMAIN="${DOMAIN,,}"
[[ -n $DOMAIN ]] || { usage; die "--domain is required."; }
[[ $DOMAIN =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || die "Invalid domain: $DOMAIN"
[[ $SKIP_TLS -eq 1 || $EMAIL =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "--email is required (or pass --skip-tls)."
[[ $BRANCH =~ ^[A-Za-z0-9._/-]+$ ]] || die "Invalid branch name: $BRANCH"
[[ -z $PORT || ($PORT =~ ^[0-9]+$ && $PORT -ge 1024 && $PORT -le 65535) ]] || die "--port must be between 1024 and 65535."
command -v apt-get >/dev/null || die "This script supports Ubuntu/Debian (apt) only."

SERVER_NAMES="$DOMAIN"
[[ $WITH_WWW -eq 1 ]] && SERVER_NAMES="$DOMAIN www.$DOMAIN"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# ---------------------------------------------------------------------------------------------
step "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl git nginx certbot python3-certbot-nginx sqlite3 xz-utils iproute2

# ---------------------------------------------------------------------------------------------
step "Installing a dedicated Node.js 22 in $NODE_DIR (the system Node.js is not touched)"
case "$(uname -m)" in
  x86_64) NODE_ARCH="x64" ;;
  aarch64 | arm64) NODE_ARCH="arm64" ;;
  *) die "Unsupported CPU architecture: $(uname -m)" ;;
esac
NODE_BASE="https://nodejs.org/dist/latest-v22.x"
curl -fsSL "$NODE_BASE/SHASUMS256.txt" -o "$WORK_DIR/SHASUMS256.txt"
NODE_TARBALL="$(grep -oE "node-v22\.[0-9]+\.[0-9]+-linux-${NODE_ARCH}\.tar\.xz" "$WORK_DIR/SHASUMS256.txt" | head -n1)"
[[ -n $NODE_TARBALL ]] || die "Could not find a Node.js 22 build for linux-$NODE_ARCH."
NODE_VERSION="${NODE_TARBALL#node-}"
NODE_VERSION="${NODE_VERSION%%-linux*}"
if [[ -x $NODE_DIR/bin/node && "$("$NODE_DIR/bin/node" --version)" == "$NODE_VERSION" ]]; then
  echo "Node.js $NODE_VERSION already installed."
else
  curl -fsSL "$NODE_BASE/$NODE_TARBALL" -o "$WORK_DIR/$NODE_TARBALL"
  (cd "$WORK_DIR" && grep " ${NODE_TARBALL}\$" SHASUMS256.txt | sha256sum -c -) || die "Node.js checksum mismatch."
  rm -rf "$NODE_DIR.new"
  mkdir -p "$NODE_DIR.new"
  tar -xJf "$WORK_DIR/$NODE_TARBALL" -C "$NODE_DIR.new" --strip-components=1
  rm -rf "$NODE_DIR"
  mv "$NODE_DIR.new" "$NODE_DIR"
  echo "Installed Node.js $("$NODE_DIR/bin/node" --version)."
fi
export PATH="$NODE_DIR/bin:$PATH"

# ---------------------------------------------------------------------------------------------
step "Creating the '$APP_USER' system user and data folders"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin "$APP_USER"
fi
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$DATA_DIR"
install -d -o root -g root -m 700 "$CONF_DIR" "$BACKUP_DIR"

# ---------------------------------------------------------------------------------------------
step "Fetching the code ($REPO_URL, branch $BRANCH) into $APP_DIR"
if [[ -d $APP_DIR/.git ]]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard FETCH_HEAD
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
git -C "$APP_DIR" log -1 --format='Deployed commit: %h %s'
# The code belongs to root: the app user can read it but never modify it.
chown -R root:root "$APP_DIR"

step "Installing production dependencies"
(cd "$APP_DIR" && npm ci --omit=dev --no-audit --no-fund)

# ---------------------------------------------------------------------------------------------
step "Writing the configuration"
port_in_use() { ss -ltnH "sport = :$1" | grep -q .; }
if [[ -f $ENV_FILE ]]; then
  CURRENT_PORT="$(sed -n 's/^PORT=//p' "$ENV_FILE")"
  [[ -n $PORT && $PORT != "$CURRENT_PORT" ]] && warn "Keeping existing PORT=$CURRENT_PORT from $ENV_FILE (edit it there to change)."
  PORT="$CURRENT_PORT"
  echo "Keeping existing $ENV_FILE (secret, port and database path unchanged)."
else
  if [[ -z $PORT ]]; then
    PORT=3000
    while port_in_use "$PORT"; do PORT=$((PORT + 1)); done
  elif port_in_use "$PORT"; then
    die "Port $PORT is already used by another program. Pick another one with --port."
  fi
  SESSION_SECRET="$(node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))")"
  (
    umask 077
    cat >"$ENV_FILE" <<EOF
# Freeleads production settings. Read by systemd (freeleads.service). Keep this file private.
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORT
SESSION_SECRET=$SESSION_SECRET
DATABASE_PATH=$DATA_DIR/freeleads.db
# Nginx is the only proxy in front of the app.
TRUST_PROXY=1
SESSION_TTL_DAYS=7
DELIVERY_HOUR=8
DELIVERY_TIMEZONE=Europe/Paris
EOF
  )
  echo "Created $ENV_FILE with a new random SESSION_SECRET (app port $PORT)."
fi
cat >"$DEPLOY_CONF" <<EOF
BRANCH=$BRANCH
DOMAIN=$DOMAIN
EOF
chmod 600 "$ENV_FILE" "$DEPLOY_CONF"

# ---------------------------------------------------------------------------------------------
step "Installing the systemd service (starts on boot, restarts on crash)"
cat >"$UNIT_FILE" <<EOF
[Unit]
Description=Freeleads web app
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_DIR/bin/node --disable-warning=ExperimentalWarning server/index.js
Restart=on-failure
RestartSec=5

# Sandboxing: the app can only write to its database folder.
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictSUIDSGID=true
RestrictNamespaces=true
RestrictRealtime=true
LockPersonality=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=
UMask=0027

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable freeleads >/dev/null
systemctl restart freeleads

echo "Waiting for the app to answer on 127.0.0.1:$PORT..."
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then APP_UP=1; break; fi
  sleep 1
done
if [[ ${APP_UP:-0} -ne 1 ]]; then
  journalctl -u freeleads -n 40 --no-pager || true
  die "The app did not start. See the log above (full log: journalctl -u freeleads)."
fi
echo "App is running."

# ---------------------------------------------------------------------------------------------
step "Configuring Nginx for $SERVER_NAMES"
cat >"$NGINX_SITE" <<EOF
# Freeleads (generated by deploy/setup-vps.sh; Certbot adds the HTTPS part).
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAMES;

    # The API accepts JSON bodies up to 20 kB.
    client_max_body_size 64k;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        # Overwritten, not appended: clients cannot spoof their IP to dodge rate limits.
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/freeleads
nginx -t
systemctl enable nginx >/dev/null
systemctl reload nginx || systemctl restart nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  step "Opening ports 80/443 in the UFW firewall"
  ufw allow 'Nginx Full'
fi

# ---------------------------------------------------------------------------------------------
TLS_OK=0
if [[ $SKIP_TLS -eq 1 ]]; then
  warn "Skipping HTTPS (--skip-tls). Logins only work over HTTPS in production: re-run without --skip-tls."
else
  step "Requesting a free HTTPS certificate from Let's Encrypt"
  SERVER_IPS=" $(hostname -I) "
  DNS_OK=1
  for name in $SERVER_NAMES; do
    RESOLVED="$(getent ahosts "$name" | awk '{print $1}' | sort -u | tr '\n' ' ')"
    MATCH=0
    for ip in $RESOLVED; do [[ $SERVER_IPS == *" $ip "* ]] && MATCH=1; done
    if [[ $MATCH -ne 1 ]]; then
      warn "$name resolves to '${RESOLVED:-nothing}', not to this server ($(hostname -I | xargs))."
      DNS_OK=0
    fi
  done
  if [[ $DNS_OK -ne 1 ]]; then
    warn "Fix the DNS A record(s) in hPanel (Domains > DNS), wait for propagation, then re-run this script."
  else
    CERTBOT_DOMAINS=()
    for name in $SERVER_NAMES; do CERTBOT_DOMAINS+=(-d "$name"); done
    if certbot --nginx --non-interactive --agree-tos --no-eff-email -m "$EMAIL" \
      --redirect --keep-until-expiring "${CERTBOT_DOMAINS[@]}"; then
      TLS_OK=1
    else
      warn "Certbot failed (see above). Check DNS and that ports 80/443 are open, then re-run."
    fi
  fi
fi

# ---------------------------------------------------------------------------------------------
step "Scheduling a daily database backup (03:15, 14 days kept in $BACKUP_DIR)"
cat >/etc/cron.d/freeleads-backup <<EOF
# Freeleads: daily SQLite backup (generated by deploy/setup-vps.sh)
15 3 * * * root /bin/bash $APP_DIR/deploy/backup.sh >/dev/null 2>&1
EOF
chmod 644 /etc/cron.d/freeleads-backup
ln -sf "$APP_DIR/deploy/update.sh" /usr/local/bin/freeleads-update

# ---------------------------------------------------------------------------------------------
step "Done"
if [[ $TLS_OK -eq 1 ]]; then
  echo "Freeleads is live at: https://$DOMAIN"
else
  echo "Freeleads is running behind Nginx at: http://$DOMAIN (HTTPS still to be set up, see warnings above)"
fi
cat <<EOF

Useful commands:
  sudo freeleads-update                 Deploy the latest code from GitHub ($BRANCH)
  sudo systemctl status freeleads       Is the app running?
  sudo journalctl -u freeleads -f       Live app log
  sudo bash $APP_DIR/deploy/backup.sh   Back up the database now
Settings (secret, port, delivery hour): $ENV_FILE  (then: sudo systemctl restart freeleads)
EOF
