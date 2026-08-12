#!/bin/sh
set -eu

archive=${1:-}
mode=${2:---verify-only}
if [ -z "$archive" ] || [ ! -f "$archive" ]; then
  echo "Usage: restore_database.sh /explicit/backup.sql.gz [--verify-only|--apply]" >&2
  exit 2
fi
if [ -f "$archive.sha256" ]; then
  shasum -a 256 -c "$archive.sha256"
else
  gzip -t "$archive"
fi
if [ "$mode" = "--verify-only" ]; then
  echo "Backup integrity verified; no database changes performed."
  exit 0
fi
if [ "$mode" != "--apply" ]; then
  echo "Second argument must be --verify-only or --apply" >&2
  exit 2
fi
database=${MYSQL_DATABASE:-xinhuo}
printf 'Type the exact target database name (%s) to continue: ' "$database" >&2
read confirmation
if [ "$confirmation" != "$database" ]; then
  echo "Confirmation mismatch; restore cancelled." >&2
  exit 3
fi
gzip -dc "$archive" | MYSQL_PWD=${MYSQL_PASSWORD:-} mysql \
  --host="${MYSQL_HOST:-localhost}" --port="${MYSQL_PORT:-3306}" \
  --user="${MYSQL_USER:-xinhuo}" --default-character-set=utf8mb4 "$database"
echo "Restore completed. Run alembic current and acceptance tests now."
