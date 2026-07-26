#!/usr/bin/env bash
set -Eeuo pipefail

set +e
node scripts/check-migration-baseline.js
baseline_status=$?
set -e

if [ "$baseline_status" -eq 10 ]; then
  echo "Existing database detected: recording the versioned baseline."
  npx prisma migrate resolve --applied 20260726050000_baseline
elif [ "$baseline_status" -ne 0 ]; then
  echo "Unable to determine migration baseline state." >&2
  exit "$baseline_status"
fi

npx prisma migrate deploy
