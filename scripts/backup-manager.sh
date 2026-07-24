#!/usr/bin/env bash
set -Eeuo pipefail

CONFIG_FILE="${CONFIG_FILE:-./backup.conf}"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi
BACKUP_DIR="${BACKUP_DIR:-backups}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  run)
    exec "${SCRIPT_DIR}/backup-prod.sh" --config "$CONFIG_FILE" "$@"
    ;;
  list)
    find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'tabularium-*' \
      -exec test -f '{}/COMPLETE' ';' -print | sort -r
    ;;
  verify)
    SET="${1:-}"
    [ -n "$SET" ] || { echo "Usage: $0 verify BACKUP_DIRECTORY" >&2; exit 2; }
    (cd "$SET" && test -f COMPLETE && sha256sum --check SHA256SUMS)
    docker exec -i "${DB_CONTAINER:-tabularium-db}" pg_restore --list < "${SET}/database.dump" >/dev/null
    [ ! -f "${SET}/uploads.tar.gz" ] || tar -tzf "${SET}/uploads.tar.gz" >/dev/null
    echo "Backup verified: $SET"
    ;;
  restore)
    exec "${SCRIPT_DIR}/restore-prod.sh" --config "$CONFIG_FILE" "$@"
    ;;
  *)
    echo "Usage: $0 {run|list|verify BACKUP_DIRECTORY|restore --backup BACKUP_DIRECTORY}"
    ;;
esac
