#!/usr/bin/env bash
# Delete zipped DB backups older than 30 days.
# Intended to run once per month.

set -euo pipefail

BACKUP_DIR="/home/world-tagger/backups"

find "$BACKUP_DIR" -maxdepth 1 -type f -name "db_backup_*.zip" -mtime +30 -delete
