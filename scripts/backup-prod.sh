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
DB_CONTAINER="${DB_CONTAINER:-tabularium-db}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-tabularium_uploads}"
UPLOADS_CONTAINER_PATH="${UPLOADS_CONTAINER_PATH:-/app/storage/uploads}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-30}"
REMOTE_BACKUP_HOST="${BACKUP_SERVER_HOST:-${REMOTE_BACKUP_HOST:-}}"
REMOTE_BACKUP_USER="${BACKUP_SERVER_USER:-${REMOTE_BACKUP_USER:-}}"
REMOTE_BACKUP_PATH="${BACKUP_REMOTE_PATH:-${REMOTE_BACKUP_PATH:-}}"
REMOTE_BACKUP_KEY="${BACKUP_SSH_KEY:-${REMOTE_BACKUP_KEY:-}}"
LABEL=""
SKIP_UPLOADS=0
SKIP_REMOTE=0
WORK_DIR=""

usage() {
  cat <<'EOF'
Usage: scripts/backup-prod.sh [options]

Options:
  --config FILE             Configuration file. Default: ./backup.conf
  --backup-dir DIR          Local backup directory. Default: backups
  --label LABEL             Extra label, e.g. pre-restore
  --retention-days DAYS     Local retention. Default: 14; 0 disables
  --remote-host HOST        SSH backup server
  --remote-user USER        SSH user
  --remote-path PATH        Remote directory
  --remote-key FILE         SSH private key
  --remote-retention DAYS   Remote retention. Default: 30; 0 disables
  --skip-uploads            Backup only PostgreSQL
  --skip-remote             Do not replicate this backup
  -h, --help                Show help

Environment:
  APP_CONTAINER, DB_CONTAINER, UPLOADS_VOLUME, UPLOADS_CONTAINER_PATH,
  BACKUP_DIR, RETENTION_DAYS,
  REMOTE_BACKUP_HOST, REMOTE_BACKUP_USER, REMOTE_BACKUP_PATH,
  REMOTE_BACKUP_KEY, REMOTE_RETENTION_DAYS
  The corresponding backup.conf keys are BACKUP_SERVER_HOST,
  BACKUP_SERVER_USER, BACKUP_REMOTE_PATH and BACKUP_SSH_KEY.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --config) shift 2 ;;
    --backup-dir) BACKUP_DIR="${2:?Missing value}"; shift 2 ;;
    --label) LABEL="${2:?Missing value}"; shift 2 ;;
    --retention-days) RETENTION_DAYS="${2:?Missing value}"; shift 2 ;;
    --remote-host) REMOTE_BACKUP_HOST="${2:?Missing value}"; shift 2 ;;
    --remote-user) REMOTE_BACKUP_USER="${2:?Missing value}"; shift 2 ;;
    --remote-path) REMOTE_BACKUP_PATH="${2:?Missing value}"; shift 2 ;;
    --remote-key) REMOTE_BACKUP_KEY="${2:?Missing value}"; shift 2 ;;
    --remote-retention) REMOTE_RETENTION_DAYS="${2:?Missing value}"; shift 2 ;;
    --skip-uploads) SKIP_UPLOADS=1; shift ;;
    --skip-remote) SKIP_REMOTE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

is_uint() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

cleanup() {
  if [ -n "$WORK_DIR" ] && [ -d "$WORK_DIR" ]; then
    rm -rf -- "$WORK_DIR"
  fi
}
trap cleanup EXIT

require_command docker
require_command flock
require_command sha256sum
require_command tar
is_uint "$RETENTION_DAYS" || { echo "Invalid RETENTION_DAYS" >&2; exit 2; }
is_uint "$REMOTE_RETENTION_DAYS" || { echo "Invalid REMOTE_RETENTION_DAYS" >&2; exit 2; }

mkdir -p "$BACKUP_DIR"
BACKUP_DIR_ABS="$(cd "$BACKUP_DIR" && pwd -P)"
exec 9>"${BACKUP_DIR_ABS}/.backup.lock"
flock -n 9 || { echo "Another backup or restore is already running" >&2; exit 1; }

if ! docker container inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "Database container not found: $DB_CONTAINER" >&2
  exit 1
fi
if [ "$SKIP_UPLOADS" -eq 0 ] && ! docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
  UPLOADS_VOLUME_DETECTED="$(
    docker inspect "$APP_CONTAINER" \
      --format "{{range .Mounts}}{{if eq .Destination \"${UPLOADS_CONTAINER_PATH}\"}}{{.Name}}{{end}}{{end}}" \
      2>/dev/null || true
  )"
  if [ -z "$UPLOADS_VOLUME_DETECTED" ] || ! docker volume inspect "$UPLOADS_VOLUME_DETECTED" >/dev/null 2>&1; then
    echo "Uploads volume not found: $UPLOADS_VOLUME" >&2
    echo "No Docker volume mounted at ${APP_CONTAINER}:${UPLOADS_CONTAINER_PATH}" >&2
    exit 1
  fi
  echo "Configured uploads volume '$UPLOADS_VOLUME' not found; detected '$UPLOADS_VOLUME_DETECTED'"
  UPLOADS_VOLUME="$UPLOADS_VOLUME_DETECTED"
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -c 'A-Za-z0-9_.-' '-')"
BASE_NAME="tabularium-${TIMESTAMP}${SAFE_LABEL:+-${SAFE_LABEL}}"
WORK_DIR="$(mktemp -d "${BACKUP_DIR_ABS}/.${BASE_NAME}.tmp.XXXXXX")"
FINAL_DIR="${BACKUP_DIR_ABS}/${BASE_NAME}"
DB_FILE="database.dump"
UPLOADS_FILE="uploads.tar.gz"

echo "Creating backup set $BASE_NAME"
docker exec "$DB_CONTAINER" sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "${WORK_DIR}/${DB_FILE}"

echo "Validating PostgreSQL dump"
docker exec -i "$DB_CONTAINER" pg_restore --list < "${WORK_DIR}/${DB_FILE}" >/dev/null

if [ "$SKIP_UPLOADS" -eq 0 ]; then
  echo "Archiving uploads volume $UPLOADS_VOLUME"
  docker run --rm \
    -v "${UPLOADS_VOLUME}:/data:ro" \
    -v "${WORK_DIR}:/backup" \
    alpine:3.20 \
    tar -czf "/backup/${UPLOADS_FILE}" -C /data .
  tar -tzf "${WORK_DIR}/${UPLOADS_FILE}" >/dev/null
else
  UPLOADS_FILE=""
fi

APP_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$APP_CONTAINER" 2>/dev/null || true)"
GIT_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
DB_BYTES="$(wc -c < "${WORK_DIR}/${DB_FILE}" | tr -d ' ')"
UPLOADS_BYTES=0
if [ -n "$UPLOADS_FILE" ]; then
  UPLOADS_BYTES="$(wc -c < "${WORK_DIR}/${UPLOADS_FILE}" | tr -d ' ')"
fi

cat > "${WORK_DIR}/manifest.json" <<EOF
{
  "formatVersion": 1,
  "status": "complete",
  "createdAt": "$(date -Iseconds)",
  "baseName": "${BASE_NAME}",
  "appImage": "${APP_IMAGE}",
  "gitSha": "${GIT_SHA}",
  "dbDump": "${DB_FILE}",
  "dbDumpBytes": ${DB_BYTES},
  "uploadsArchive": "${UPLOADS_FILE}",
  "uploadsArchiveBytes": ${UPLOADS_BYTES}
}
EOF

(
  cd "$WORK_DIR"
  sha256sum "$DB_FILE" ${UPLOADS_FILE:+"$UPLOADS_FILE"} manifest.json > SHA256SUMS
  sha256sum --check SHA256SUMS
  touch COMPLETE
)

mv "$WORK_DIR" "$FINAL_DIR"
WORK_DIR=""

if [ -n "$REMOTE_BACKUP_HOST" ] && [ "$SKIP_REMOTE" -eq 0 ]; then
  require_command ssh
  require_command rsync
  [ -n "$REMOTE_BACKUP_USER" ] || { echo "REMOTE_BACKUP_USER is required for remote backup" >&2; exit 1; }
  [ -n "$REMOTE_BACKUP_PATH" ] || { echo "REMOTE_BACKUP_PATH is required for remote backup" >&2; exit 1; }
  [ -n "$REMOTE_BACKUP_KEY" ] || { echo "REMOTE_BACKUP_KEY is required for remote backup" >&2; exit 1; }
  [ -r "$REMOTE_BACKUP_KEY" ] || { echo "Remote key not readable: $REMOTE_BACKUP_KEY" >&2; exit 1; }
  SSH_ARGS=(-i "$REMOTE_BACKUP_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
  REMOTE="${REMOTE_BACKUP_USER}@${REMOTE_BACKUP_HOST}"
  echo "Replicating backup to ${REMOTE}:${REMOTE_BACKUP_PATH}"
  ssh "${SSH_ARGS[@]}" "$REMOTE" mkdir -p -- "$REMOTE_BACKUP_PATH"
  rsync -a --protect-args -e "ssh -i ${REMOTE_BACKUP_KEY} -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
    "$FINAL_DIR" "${REMOTE}:${REMOTE_BACKUP_PATH}/"
  ssh "${SSH_ARGS[@]}" "$REMOTE" \
    "cd '$REMOTE_BACKUP_PATH/$BASE_NAME' && sha256sum --check SHA256SUMS >/dev/null && test -f COMPLETE"
  if [ "$REMOTE_RETENTION_DAYS" != "0" ]; then
    ssh "${SSH_ARGS[@]}" "$REMOTE" \
      "find '$REMOTE_BACKUP_PATH' -mindepth 1 -maxdepth 1 -type d -name 'tabularium-*' -mtime +$REMOTE_RETENTION_DAYS -exec rm -rf -- {} +"
  fi
fi

if [ "$RETENTION_DAYS" != "0" ]; then
  find "$BACKUP_DIR_ABS" -mindepth 1 -maxdepth 1 -type d \
    -name 'tabularium-*' -mtime +"$RETENTION_DAYS" -exec rm -rf -- {} +
fi

echo "Backup completed and verified: $FINAL_DIR"
