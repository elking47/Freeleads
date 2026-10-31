#!/usr/bin/env bash
# Freeleads: consistent online backup of the SQLite database (safe while the app is running).
# Run daily by /etc/cron.d/freeleads-backup; keeps the last 14 days.
set -Eeuo pipefail

ENV_FILE="/etc/freeleads/freeleads.env"
BACKUP_DIR="/var/backups/freeleads"
KEEP_DAYS=14

DB="$(sed -n 's/^DATABASE_PATH=//p' "$ENV_FILE")"
if [[ ! -f $DB ]]; then
  echo "No database yet at $DB; nothing to back up."
  exit 0
fi

install -d -m 700 "$BACKUP_DIR"
TARGET="$BACKUP_DIR/freeleads-$(date +%Y%m%d-%H%M%S).db"
sqlite3 "$DB" ".backup '$TARGET'"
gzip -f "$TARGET"
chmod 600 "$TARGET.gz"
find "$BACKUP_DIR" -name 'freeleads-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup written: $TARGET.gz"
