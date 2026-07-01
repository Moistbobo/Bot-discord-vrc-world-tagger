#!/usr/bin/env bash
# Delete compressed tslog backups older than 7 days.
# Intended to run once per week.
LOG_DIR="/home/world-tagger/release/Bot-discord-vrc-world-tagger"

find "$LOG_DIR" -maxdepth 1 -type f -name "*-tslog.log.gz" -mtime +7 -delete
