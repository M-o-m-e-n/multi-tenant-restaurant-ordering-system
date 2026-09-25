#!/usr/bin/env sh
# Restore a backup into an EMPTY database (NFR-A3). Never point this at a live
# database: restore beside it, check it, then switch DATABASE_URL.
#
#   RESTORE_URL=postgres://…/ros_restore ./scripts/restore.sh backups/ros-20260925T031500Z.dump
set -eu

dump="${1:?usage: restore.sh <file.dump>}"
: "${RESTORE_URL:?RESTORE_URL is required (an empty database)}"

pg_restore --no-owner --no-privileges --exit-on-error --dbname="$RESTORE_URL" "$dump"

# Sanity check: row counts of the tables that matter most.
psql "$RESTORE_URL" --no-psqlrc --tuples-only --command \
  'SELECT '"'"'orders='"'"' || count(*) FROM "Order"
   UNION ALL SELECT '"'"'payments='"'"' || count(*) FROM "Payment"
   UNION ALL SELECT '"'"'users='"'"' || count(*) FROM "User"
   UNION ALL SELECT '"'"'migrations='"'"' || count(*) FROM "_prisma_migrations";'
echo "restore complete: $dump → $RESTORE_URL"
