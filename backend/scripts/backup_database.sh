#!/bin/sh
set -eu

backup_dir=${1:-}
if [ -z "$backup_dir" ]; then
  echo "Usage: backup_database.sh /explicit/backup/directory" >&2
  exit 2
fi
mkdir -p "$backup_dir"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
database=${MYSQL_DATABASE:-xinhuo}
output="$backup_dir/xinhuo-$timestamp.sql.gz"
umask 077

MYSQL_PWD=${MYSQL_PASSWORD:-} mysqldump \
  --host="${MYSQL_HOST:-localhost}" --port="${MYSQL_PORT:-3306}" \
  --user="${MYSQL_USER:-xinhuo}" --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 "$database" | gzip -9 > "$output"
shasum -a 256 "$output" > "$output.sha256"
printf '{"database":"%s","createdAt":"%s","file":"%s"}\n' "$database" "$timestamp" "$(basename "$output")" > "$output.json"
if [ "${BACKUP_RETENTION_DAYS:-30}" -gt 0 ]; then
  find "$backup_dir" -type f -name 'xinhuo-*.sql.gz*' -mtime "+${BACKUP_RETENTION_DAYS:-30}" -delete
fi
echo "$output"
