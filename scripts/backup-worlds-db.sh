#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Hot-backup script for the worlds.db SQLite database.
# This creates a clean snapshot via sqlite3 .backup (zero downtime),
# downloads it via scp, and cleans up the remote temp file.
#
# Usage:
#   ./backup-worlds-db.sh
#
# Requirements:
#   - sqlite3 installed on the remote VPS
#   - SSH key-based auth (no password prompt)
# =============================================================================

# --- CONFIG: fill these in --------------------------------------------------
REMOTE_USER="world-tagger"          # SSH user for the VPS
REMOTE_HOST="178.128.234.212"        # VPS IP or hostname
REMOTE_DB_PATH="/home/world-tagger/test/Bot-discord-vrc-world-tagger/worlds.db"
LOCAL_DEST="./worlds_backup_$(date +%Y%m%d_%H%M%S).db"
REMOTE_TEMP="/tmp/worlds_backup_$(date +%s).db"
# ----------------------------------------------------------------------------

echo "[1/4] Creating hot snapshot on ${REMOTE_HOST} ..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" \
  "sqlite3 '${REMOTE_DB_PATH}' '.backup ${REMOTE_TEMP}'"

echo "[2/4] Downloading snapshot ..."
scp "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_TEMP}" "${LOCAL_DEST}"

echo "[3/4] Cleaning up remote temp file ..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "rm -f '${REMOTE_TEMP}'"

echo "[4/4] Verifying local copy ..."
if command -v sqlite3 &>/dev/null; then
  ROWS=$(sqlite3 "${LOCAL_DEST}" "SELECT COUNT(*) FROM worlds;" 2>/dev/null || echo "?")
  echo "Backup saved: ${LOCAL_DEST}"
  echo "Worlds table rows: ${ROWS}"
else
  echo "Backup saved: ${LOCAL_DEST}"
  echo "(sqlite3 not installed locally — skipping row count verification)"
fi

echo "Done."
