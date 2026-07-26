#!/usr/bin/env bash
set -Eeuo pipefail

CONFIG_FILE="${CONFIG_FILE:-./backup.conf}"
args=("$@")
while [ "$#" -gt 0 ]; do
  case "$1" in
    --config) CONFIG_FILE="${2:?Missing value for --config}"; shift 2 ;;
    *) shift ;;
  esac
done
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
elif [ "$CONFIG_FILE" != "./backup.conf" ]; then
  echo "Configuration file not found: $CONFIG_FILE" >&2
  exit 1
fi
set -- "${args[@]}"

APP_CONTAINER="${APP_CONTAINER:-tabularium}"
APP_SERVICE="${APP_SERVICE:-tabularium}"
DB_CONTAINER="${DB_CONTAINER:-tabularium-db}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-tabularium_uploads}"
UPLOADS_CONTAINER_PATH="${UPLOADS_CONTAINER_PATH:-/app/storage/uploads}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_SET=""
YES=0
SKIP_PRE_BACKUP=0
SKIP_DB_PUSH=0
APP_STOPPED=0

usage() {
  cat <<'EOF'
Usage: scripts/restore-prod.sh --backup SET_DIRECTORY [options]

Options:
  --config FILE         Configuration file. Default: ./backup.conf
  --backup DIR          Complete backup set to restore
  --yes                 Skip typed confirmation (automation only)
  --skip-pre-backup     Do not create a safety backup
  --skip-db-push        Do not apply the current Prisma schema
  --compose-file FILE   Default: docker-compose.prod.yml
  --env-file FILE       Default: .env.production
  -h, --help            Show help

The backup must contain manifest.json, SHA256SUMS, COMPLETE and database.dump.
This operation is destructive.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --config) shift 2 ;;
    --backup) BACKUP_SET="${2:?Missing value}"; shift 2 ;;
    --yes) YES=1; shift ;;
    --skip-pre-backup) SKIP_PRE_BACKUP=1; shift ;;
    --skip-db-push) SKIP_DB_PUSH=1; shift ;;
    --compose-file) COMPOSE_FILE="${2:?Missing value}"; shift 2 ;;
    --env-file) ENV_FILE="${2:?Missing value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

start_app_on_failure() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$APP_STOPPED" -eq 1 ]; then
    echo "Restore failed; attempting to start the application" >&2
    compose up -d "$APP_SERVICE" >/dev/null 2>&1 || docker start "$APP_CONTAINER" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap start_app_on_failure EXIT

[ -n "$BACKUP_SET" ] || { echo "--backup is required" >&2; usage >&2; exit 2; }
BACKUP_SET="$(cd "$BACKUP_SET" 2>/dev/null && pwd -P)" || {
  echo "Backup directory not found: $BACKUP_SET" >&2
  exit 1
}
for file in manifest.json SHA256SUMS COMPLETE database.dump; do
  [ -f "${BACKUP_SET}/${file}" ] || { echo "Incomplete backup: missing $file" >&2; exit 1; }
done

echo "Verifying backup checksums and archives"
(cd "$BACKUP_SET" && sha256sum --check SHA256SUMS)
docker exec -i "$DB_CONTAINER" pg_restore --list < "${BACKUP_SET}/database.dump" >/dev/null
if [ -f "${BACKUP_SET}/uploads.tar.gz" ]; then
  tar -tzf "${BACKUP_SET}/uploads.tar.gz" >/dev/null
  if ! docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
    UPLOADS_VOLUME_DETECTED="$(
      docker inspect "$APP_CONTAINER" \
        --format "{{range .Mounts}}{{if eq .Destination \"${UPLOADS_CONTAINER_PATH}\"}}{{.Name}}{{end}}{{end}}" \
        2>/dev/null || true
    )"
    if [ -z "$UPLOADS_VOLUME_DETECTED" ] || ! docker volume inspect "$UPLOADS_VOLUME_DETECTED" >/dev/null 2>&1; then
      echo "Uploads volume not found: $UPLOADS_VOLUME" >&2
      exit 1
    fi
    echo "Configured uploads volume '$UPLOADS_VOLUME' not found; detected '$UPLOADS_VOLUME_DETECTED'"
    UPLOADS_VOLUME="$UPLOADS_VOLUME_DETECTED"
  fi
fi

echo "Restore source: $BACKUP_SET"
if [ "$YES" -ne 1 ]; then
  echo "This operation replaces the production database and uploads."
  printf 'Type RESTORE to continue: '
  read -r confirmation
  [ "$confirmation" = "RESTORE" ] || { echo "Restore aborted"; exit 1; }
fi

if [ "$SKIP_PRE_BACKUP" -eq 0 ]; then
  echo "Creating and verifying pre-restore safety backup"
  "$(dirname "$0")/backup-prod.sh" --backup-dir "$BACKUP_DIR" --label pre-restore --skip-remote
fi

mkdir -p "$BACKUP_DIR"
exec 9>"${BACKUP_DIR}/.backup.lock"
flock -n 9 || { echo "Another backup or restore is already running" >&2; exit 1; }

echo "Stopping application"
compose stop "$APP_SERVICE" || docker stop "$APP_CONTAINER"
APP_STOPPED=1

echo "Restoring PostgreSQL"
docker exec -i "$DB_CONTAINER" sh -c \
  'pg_restore --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < "${BACKUP_SET}/database.dump"

if [ -f "${BACKUP_SET}/uploads.tar.gz" ]; then
  echo "Restoring uploads"
  docker run --rm \
    -v "${UPLOADS_VOLUME}:/data" \
    -v "${BACKUP_SET}:/backup:ro" \
    alpine:3.20 \
    sh -c "find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xzf /backup/uploads.tar.gz -C /data"
fi

if [ "$SKIP_DB_PUSH" -eq 0 ]; then
  echo "Applying current Prisma schema"
  compose run --rm "$APP_SERVICE" npm run db:deploy
fi

echo "Starting application"
compose up -d "$APP_SERVICE"
APP_STOPPED=0
compose ps "$APP_SERVICE"
echo "Restore completed"
