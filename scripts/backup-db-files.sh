#!/usr/bin/env bash
# Zips db.json, worlds.db, and related SQLite files into a dated backup.
# Run daily via cron.

set -euo pipefail

APP_DIR="/home/world-tagger/release/Bot-discord-vrc-world-tagger"
BACKUP_DIR="/home/world-tagger/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
ZIP_FILE="$BACKUP_DIR/db_backup_$DATE.zip"

cd "$APP_DIR"

mkdir -p "$BACKUP_DIR"

zip -j "$ZIP_FILE" \
  "$APP_DIR/db.json" \
  "$APP_DIR/worlds.db" \
  "$APP_DIR/worlds.db-shm" \
  "$APP_DIR/worlds.db-wal" \
  2>/dev/null

# Optional: remove older 30-day retention cleanup if monthly deletion is handled separately.
# find "$BACKUP_DIR" -maxdepth 1 -type f -name "db_backup_*.zip" -mtime +30 -delete

# Daily backups are kept; old backups are pruned by delete-old-db-backups.sh (monthly).
