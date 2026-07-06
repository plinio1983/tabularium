#!/usr/bin/env bash
set -Eeuo pipefail

APP_CONTAINER="${APP_CONTAINER:-tabularium}"
DB_CONTAINER="${DB_CONTAINER:-tabularium-db}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-tabularium_uploads}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
RCLONE_DEST="${RCLONE_DEST:-}"
LABEL=""
SKIP_UPLOADS=0
SKIP_RCLONE=0

usage() {
  cat <<'EOF'
Usage: scripts/backup-prod.sh [options]

Options:
  --backup-dir DIR       Directory where backup files are written. Default: backups
  --label LABEL          Extra label in generated filenames, e.g. pre-restore
  --retention-days DAYS  Delete backup sets older than DAYS. Default: 30. Use 0 to disable
  --rclone-dest REMOTE   Optional rclone destination, e.g. remote:tabularium-backups
  --skip-uploads         Backup only the PostgreSQL database
  --skip-rclone          Do not run rclone even if RCLONE_DEST is configured
  -h, --help             Show this help

Environment overrides:
  APP_CONTAINER, DB_CONTAINER, UPLOADS_VOLUME, BACKUP_DIR, RETENTION_DAYS, RCLONE_DEST
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backup-dir)
      BACKUP_DIR="${2:?Missing value for --backup-dir}"
      shift 2
      ;;
    --label)
      LABEL="${2:?Missing value for --label}"
      shift 2
      ;;
    --retention-days)
      RETENTION_DAYS="${2:?Missing value for --retention-days}"
      shift 2
      ;;
    --rclone-dest)
      RCLONE_DEST="${2:?Missing value for --rclone-dest}"
      shift 2
      ;;
    --skip-uploads)
      SKIP_UPLOADS=1
      shift
      ;;
    --skip-rclone)
      SKIP_RCLONE=1
      shift
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

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

safe_label() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9_.-' '-'
}

require_command docker

mkdir -p "$BACKUP_DIR"
BACKUP_DIR_ABS="$(cd "$BACKUP_DIR" && pwd -P)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LABEL_SUFFIX=""
if [ -n "$LABEL" ]; then
  LABEL_SUFFIX="-$(safe_label "$LABEL")"
fi
BASE_NAME="tabularium-${TIMESTAMP}${LABEL_SUFFIX}"
DB_DUMP="${BACKUP_DIR_ABS}/${BASE_NAME}.dump"
UPLOADS_ARCHIVE="${BACKUP_DIR_ABS}/${BASE_NAME}-uploads.tar.gz"
MANIFEST="${BACKUP_DIR_ABS}/${BASE_NAME}.json"

echo "Starting backup ${BASE_NAME}"

if ! docker container inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "Database container not found: ${DB_CONTAINER}" >&2
  exit 1
fi

if [ "$SKIP_UPLOADS" -eq 0 ] && ! docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
  echo "Uploads volume not found: ${UPLOADS_VOLUME}" >&2
  exit 1
fi

APP_IMAGE=""
if docker container inspect "$APP_CONTAINER" >/dev/null 2>&1; then
  APP_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$APP_CONTAINER" 2>/dev/null || true)"
fi

GIT_SHA=""
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || true)"
fi

echo "Dumping PostgreSQL from ${DB_CONTAINER}"
docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "${DB_DUMP}.tmp"
mv "${DB_DUMP}.tmp" "$DB_DUMP"

if [ "$SKIP_UPLOADS" -eq 0 ]; then
  echo "Archiving uploads volume ${UPLOADS_VOLUME}"
  docker run --rm \
    -v "${UPLOADS_VOLUME}:/data:ro" \
    -v "${BACKUP_DIR_ABS}:/backup" \
    alpine:3.20 \
    sh -c "tar -czf '/backup/${BASE_NAME}-uploads.tar.gz.tmp' -C /data ."
  mv "${UPLOADS_ARCHIVE}.tmp" "$UPLOADS_ARCHIVE"
else
  UPLOADS_ARCHIVE=""
fi

DB_SIZE="$(wc -c < "$DB_DUMP" | tr -d ' ')"
UPLOADS_BASENAME=""
UPLOADS_SIZE=""
if [ -n "$UPLOADS_ARCHIVE" ]; then
  UPLOADS_BASENAME="$(basename "$UPLOADS_ARCHIVE")"
  UPLOADS_SIZE="$(wc -c < "$UPLOADS_ARCHIVE" | tr -d ' ')"
fi

cat > "${MANIFEST}.tmp" <<EOF
{
  "createdAt": "$(date -Iseconds)",
  "baseName": "$(json_escape "$BASE_NAME")",
  "appContainer": "$(json_escape "$APP_CONTAINER")",
  "appImage": "$(json_escape "$APP_IMAGE")",
  "dbContainer": "$(json_escape "$DB_CONTAINER")",
  "uploadsVolume": "$(json_escape "$UPLOADS_VOLUME")",
  "gitSha": "$(json_escape "$GIT_SHA")",
  "dbDump": "$(json_escape "$(basename "$DB_DUMP")")",
  "dbDumpBytes": ${DB_SIZE},
  "uploadsArchive": "$(json_escape "$UPLOADS_BASENAME")",
  "uploadsArchiveBytes": ${UPLOADS_SIZE:-0}
}
EOF
mv "${MANIFEST}.tmp" "$MANIFEST"

if [ "${RETENTION_DAYS}" != "0" ]; then
  echo "Applying local retention: ${RETENTION_DAYS} days"
  find "$BACKUP_DIR_ABS" -maxdepth 1 -type f \
    \( -name 'tabularium-*.dump' -o -name 'tabularium-*-uploads.tar.gz' -o -name 'tabularium-*.json' \) \
    -mtime +"$RETENTION_DAYS" -print -delete
fi

if [ -n "$RCLONE_DEST" ] && [ "$SKIP_RCLONE" -eq 0 ]; then
  require_command rclone
  echo "Copying backup files to ${RCLONE_DEST}"
  rclone copy "$BACKUP_DIR_ABS" "$RCLONE_DEST"
fi

echo "Backup completed:"
echo "  manifest: ${MANIFEST}"
echo "  db dump:  ${DB_DUMP}"
if [ -n "$UPLOADS_ARCHIVE" ]; then
  echo "  uploads:  ${UPLOADS_ARCHIVE}"
fi
