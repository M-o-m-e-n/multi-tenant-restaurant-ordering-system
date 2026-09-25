#!/usr/bin/env sh
# Nightly logical backup (NFR-A3, HLD §11.5).
#
#   DATABASE_URL=postgres://… BACKUP_DIR=/var/backups/ros ./scripts/backup.sh
#
# Writes a compressed custom-format dump named by UTC timestamp, keeps 30 days,
# and, when BACKUP_BUCKET is set (e.g. s3://ros-backups/prod), copies it to
# object storage with the AWS CLI. Schedule it from cron or the platform's job
# runner: `15 3 * * * /app/scripts/backup.sh`.
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/ros-$stamp.dump"

# Custom format (-Fc) is compressed and restorable table by table with pg_restore.
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$file"
echo "backup written: $file ($(wc -c <"$file") bytes)"

if [ -n "${BACKUP_BUCKET:-}" ]; then
  aws s3 cp "$file" "$BACKUP_BUCKET/" --only-show-errors
  echo "uploaded to $BACKUP_BUCKET"
fi

# Local retention; object storage uses a 30-day lifecycle rule on the bucket.
find "$BACKUP_DIR" -name 'ros-*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete
