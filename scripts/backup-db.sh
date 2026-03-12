#!/bin/bash
# Define variables
SOURCE="/db.json"
BACKUP_DIR="/home/user/backups/world-tagger-db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.json"

# Create the backup
cp $SOURCE $BACKUP_FILE

# Optional: Remove backups older than 7 days
find $BACKUP_DIR -type f -name "db_backup_*.json" -mtime +7 -exec rm {} \;
