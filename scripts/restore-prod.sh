#!/usr/bin/env bash
set -Eeuo pipefail

APP_CONTAINER="${APP_CONTAINER:-tabularium}"
APP_SERVICE="${APP_SERVICE:-tabularium}"
DB_CONTAINER="${DB_CONTAINER:-tabularium-db}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-tabularium_uploads}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
DB_DUMP=""
UPLOADS_ARCHIVE=""
YES=0
SKIP_PRE_BACKUP=0
SKIP_APP_STOP=0
SKIP_DB_PUSH=0

usage() {
  cat <<'EOF'
Usage: scripts/restore-prod.sh --db-dump FILE [options]

Options:
  --db-dump FILE         PostgreSQL custom dump to restore. Required
  --uploads FILE         Uploads .tar.gz archive to restore
  --yes                  Do not prompt; required for non-interactive runs
  --skip-pre-backup      Do not create a safety backup before restore
  --skip-app-stop        Do not stop/start the app container around restore
  --skip-db-push         Do not run prisma db push after restore
  --compose-file FILE    Compose file. Default: docker-compose.prod.yml
  --env-file FILE        Compose env file. Default: .env.production
  -h, --help             Show this help

Environment overrides:
  APP_CONTAINER, APP_SERVICE, DB_CONTAINER, UPLOADS_VOLUME, COMPOSE_FILE, ENV_FILE

This is destructive. It restores the database with pg_restore --clean --if-exists.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --db-dump)
      DB_DUMP="${2:?Missing value for --db-dump}"
      shift 2
      ;;
    --uploads)
      UPLOADS_ARCHIVE="${2:?Missing value for --uploads}"
      shift 2
      ;;
    --yes)
      YES=1
      shift
      ;;
    --skip-pre-backup)
      SKIP_PRE_BACKUP=1
      shift
      ;;
    --skip-app-stop)
      SKIP_APP_STOP=1
      shift
      ;;
    --skip-db-push)
      SKIP_DB_PUSH=1
      shift
      ;;
    --compose-file)
      COMPOSE_FILE="${2:?Missing value for --compose-file}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:?Missing value for --env-file}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

abs_path() {
  local path="$1"
  local dir
  local base
  dir="$(dirname "$path")"
  base="$(basename "$path")"
  printf '%s/%s' "$(cd "$dir" && pwd -P)" "$base"
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_command docker

if [ -z "$DB_DUMP" ]; then
  echo "--db-dump is required" >&2
  usage >&2
  exit 2
fi

if [ ! -f "$DB_DUMP" ]; then
  echo "DB dump not found: $DB_DUMP" >&2
  exit 1
fi

if [ -n "$UPLOADS_ARCHIVE" ] && [ ! -f "$UPLOADS_ARCHIVE" ]; then
  echo "Uploads archive not found: $UPLOADS_ARCHIVE" >&2
  exit 1
fi

if ! docker container inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "Database container not found: ${DB_CONTAINER}" >&2
  exit 1
fi

if [ -n "$UPLOADS_ARCHIVE" ] && ! docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
  echo "Uploads volume not found: ${UPLOADS_VOLUME}" >&2
  exit 1
fi

echo "Restore target:"
echo "  db container:     ${DB_CONTAINER}"
echo "  app container:    ${APP_CONTAINER}"
echo "  app service:      ${APP_SERVICE}"
echo "  uploads volume:   ${UPLOADS_VOLUME}"
echo "  db dump:          ${DB_DUMP}"
if [ -n "$UPLOADS_ARCHIVE" ]; then
  echo "  uploads archive:  ${UPLOADS_ARCHIVE}"
fi

if [ "$YES" -ne 1 ]; then
  echo
  echo "This operation is destructive."
  printf 'Type RESTORE to continue: '
  read -r confirmation
  if [ "$confirmation" != "RESTORE" ]; then
    echo "Restore aborted."
    exit 1
  fi
fi

if [ "$SKIP_PRE_BACKUP" -eq 0 ]; then
  echo "Creating safety backup before restore"
  "$(dirname "$0")/backup-prod.sh" --label pre-restore
fi

if [ "$SKIP_APP_STOP" -eq 0 ]; then
  echo "Stopping app container"
  if [ -f "$COMPOSE_FILE" ] && [ -f "$ENV_FILE" ]; then
    compose stop "$APP_SERVICE" || docker stop "$APP_CONTAINER"
  else
    docker stop "$APP_CONTAINER"
  fi
fi

echo "Restoring PostgreSQL dump"
docker exec -i "$DB_CONTAINER" sh -c 'pg_restore --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$DB_DUMP"

if [ -n "$UPLOADS_ARCHIVE" ]; then
  UPLOADS_ABS="$(abs_path "$UPLOADS_ARCHIVE")"
  UPLOADS_DIR="$(dirname "$UPLOADS_ABS")"
  UPLOADS_FILE="$(basename "$UPLOADS_ABS")"
  echo "Restoring uploads volume"
  docker run --rm \
    -v "${UPLOADS_VOLUME}:/data" \
    -v "${UPLOADS_DIR}:/backup:ro" \
    alpine:3.20 \
    sh -c "find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -xzf '/backup/${UPLOADS_FILE}' -C /data"
fi

if [ "$SKIP_DB_PUSH" -eq 0 ]; then
  echo "Applying Prisma schema"
  if [ -f "$COMPOSE_FILE" ] && [ -f "$ENV_FILE" ]; then
    compose run --rm "$APP_SERVICE" npx prisma db push
  else
    docker exec "$APP_CONTAINER" npx prisma db push
  fi
fi

if [ "$SKIP_APP_STOP" -eq 0 ]; then
  echo "Starting app"
  if [ -f "$COMPOSE_FILE" ] && [ -f "$ENV_FILE" ]; then
    compose up -d "$APP_SERVICE"
  else
    docker start "$APP_CONTAINER"
  fi
fi

echo "Restore completed."
