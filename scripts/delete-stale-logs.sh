LOG_DIR="/dir"


find $BACKUP_DIR -type f -name "*-tslog.log.gz" -mtime +7 -exec rm {} \;
