#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="./deploy.conf"
SERVER_HOST=""
SERVER_USER=""
SSH_KEY=""
REMOTE_DIR=""
IMAGE_TAG=""
IMAGE_NAME=""
ARCHIVE_NAME=""
ARCHIVE_PATH=""
DB_DUMP=""
IMPORT_DB=0
UPLOADS_ARCHIVE=""
REMOTE_DB_DUMP=""
REMOTE_UPLOADS_ARCHIVE=""
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

usage() {
  cat <<'USAGE'
Uso:
  .devops/deploy.sh [opzioni]

Opzioni:
  --config PATH                   File configurazione. Default: ./deploy.conf se esiste.
  --import-db                     Abilita il ripristino distruttivo del database.
  --db-dump PATH                  Dump PostgreSQL custom da importare.
  --uploads-archive PATH          Archivio .tar.gz degli upload da ripristinare.
  --server-host HOST              Host/IP del server.
  --server-user USER              Utente SSH.
  --ssh-key PATH                  Chiave SSH.
  --remote-dir PATH               Directory remota.
  --image-tag TAG                 Tag immagine.
  --image-name NAME               Nome immagine completo.
  -h, --help                      Mostra questo aiuto.

Config richiesti via file o CLI:
  SERVER_HOST, SERVER_USER, SSH_KEY, REMOTE_DIR

Esempi:
  .devops/deploy.sh
  .devops/deploy.sh --import-db --db-dump ./tabularium.dump
  .devops/deploy.sh --uploads-archive ./tabularium-uploads.tar.gz
  .devops/deploy.sh --import-db --db-dump ./tabularium.dump --uploads-archive ./tabularium-uploads.tar.gz
USAGE
}

require_value() {
  local option="$1"
  local value="${2:-}"
  if [[ -z "${value}" || "${value}" == --* ]]; then
    echo "${option} richiede un valore." >&2
    usage >&2
    exit 1
  fi
}

args=("$@")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      require_value "$1" "${2:-}"
      CONFIG_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
elif [[ "${CONFIG_FILE}" != "./deploy.conf" ]]; then
  echo "File configurazione non trovato: ${CONFIG_FILE}" >&2
  exit 1
fi

set -- "${args[@]}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      shift 2
      ;;
    --import-db)
      IMPORT_DB=1
      shift
      ;;
    --db-dump)
      require_value "$1" "${2:-}"
      DB_DUMP="${2:-}"
      shift 2
      ;;
    --uploads-archive)
      require_value "$1" "${2:-}"
      UPLOADS_ARCHIVE="${2:-}"
      shift 2
      ;;
    --server-host)
      require_value "$1" "${2:-}"
      SERVER_HOST="${2:-}"
      shift 2
      ;;
    --server-user)
      require_value "$1" "${2:-}"
      SERVER_USER="${2:-}"
      shift 2
      ;;
    --ssh-key)
      require_value "$1" "${2:-}"
      SSH_KEY="${2:-}"
      shift 2
      ;;
    --remote-dir)
      require_value "$1" "${2:-}"
      REMOTE_DIR="${2:-}"
      shift 2
      ;;
    --image-tag)
      require_value "$1" "${2:-}"
      IMAGE_TAG="${2:-}"
      IMAGE_NAME="tabularium:${IMAGE_TAG}"
      ARCHIVE_NAME="tabularium-${IMAGE_TAG}.tar.gz"
      ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"
      shift 2
      ;;
    --image-name)
      require_value "$1" "${2:-}"
      IMAGE_NAME="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opzione sconosciuta: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

SERVER_HOST="${SERVER_HOST:-}"
SERVER_USER="${SERVER_USER:-}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_DIR="${REMOTE_DIR:-}"
if [[ -f "${ENV_FILE}" ]]; then
  ENV_APP_IMAGE="$(grep -E '^APP_IMAGE=' "${ENV_FILE}" | tail -n 1 | cut -d= -f2- | sed -E 's/^["'\'']?//; s/["'\'']?$//')"
else
  ENV_APP_IMAGE=""
fi

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE_NAME="${IMAGE_NAME:-${ENV_APP_IMAGE}}"
ARCHIVE_NAME="${ARCHIVE_NAME:-tabularium-${IMAGE_TAG}.tar.gz}"
ARCHIVE_PATH="${ARCHIVE_PATH:-/tmp/${ARCHIVE_NAME}}"

if [[ -z "${SERVER_HOST}" || -z "${SERVER_USER}" || -z "${SSH_KEY}" || -z "${REMOTE_DIR}" || -z "${IMAGE_TAG}" || -z "${IMAGE_NAME}" ]]; then
  echo "Parametri server o immagine incompleti." >&2
  usage >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "File Compose non trovato: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "File env produzione non trovato: ${ENV_FILE}" >&2
  exit 1
fi

if [[ -z "${ENV_APP_IMAGE}" ]]; then
  echo "APP_IMAGE non configurata in ${ENV_FILE}." >&2
  exit 1
fi

if [[ "${IMAGE_NAME}" != "${ENV_APP_IMAGE}" ]]; then
  echo "IMAGE_NAME (${IMAGE_NAME}) deve coincidere con APP_IMAGE in ${ENV_FILE} (${ENV_APP_IMAGE})." >&2
  exit 1
fi

if [[ -n "${DB_DUMP}" && ! -f "${DB_DUMP}" ]]; then
  echo "Dump database non trovato: ${DB_DUMP}" >&2
  exit 1
fi

if [[ -n "${UPLOADS_ARCHIVE}" && ! -f "${UPLOADS_ARCHIVE}" ]]; then
  echo "Archivio upload non trovato: ${UPLOADS_ARCHIVE}" >&2
  exit 1
fi

if [[ -n "${DB_DUMP}" && "${IMPORT_DB}" != "1" ]]; then
  echo "--db-dump richiede --import-db. L'import del database e' distruttivo." >&2
  exit 1
fi

docker build --pull -t "${IMAGE_NAME}" .
docker save "${IMAGE_NAME}" | gzip > "${ARCHIVE_PATH}"

ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_HOST}" "mkdir -p '${REMOTE_DIR}'"

scp -i "${SSH_KEY}" \
  "${ARCHIVE_PATH}" \
  "${COMPOSE_FILE}" \
  "${ENV_FILE}" \
  "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"

if [[ "${IMPORT_DB}" == "1" && -n "${DB_DUMP}" ]]; then
  REMOTE_DB_DUMP="${REMOTE_DIR}/$(basename "${DB_DUMP}")"
  scp -i "${SSH_KEY}" "${DB_DUMP}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DB_DUMP}"
fi

if [[ -n "${UPLOADS_ARCHIVE}" ]]; then
  REMOTE_UPLOADS_ARCHIVE="${REMOTE_DIR}/$(basename "${UPLOADS_ARCHIVE}")"
  scp -i "${SSH_KEY}" "${UPLOADS_ARCHIVE}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_UPLOADS_ARCHIVE}"
fi

ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_HOST}" \
  "set -euo pipefail; \
   cd '${REMOTE_DIR}'; \
   if docker compose version >/dev/null 2>&1; then \
     COMPOSE='docker compose'; \
   elif command -v docker-compose >/dev/null 2>&1; then \
     COMPOSE='docker-compose'; \
   else \
     echo 'Docker Compose non trovato sul server. Installa il plugin docker compose o docker-compose.' >&2; \
     exit 1; \
   fi; \
   docker load -i '${ARCHIVE_NAME}'; \
   \$COMPOSE --env-file '${ENV_FILE}' -f docker-compose.prod.yml up -d; \
   if [ '${IMPORT_DB}' = '1' ] && [ -n '${REMOTE_DB_DUMP}' ]; then \
     \$COMPOSE --env-file '${ENV_FILE}' -f docker-compose.prod.yml exec -T tabularium-db sh -c 'pg_restore --clean --if-exists --no-owner --no-acl -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"' < '${REMOTE_DB_DUMP}'; \
   fi; \
   \$COMPOSE --env-file '${ENV_FILE}' -f docker-compose.prod.yml exec -T tabularium npx prisma db push; \
   if [ -n '${REMOTE_UPLOADS_ARCHIVE}' ]; then \
     \$COMPOSE --env-file '${ENV_FILE}' -f docker-compose.prod.yml cp '${REMOTE_UPLOADS_ARCHIVE}' tabularium:/tmp/tabularium-uploads.tar.gz; \
     \$COMPOSE --env-file '${ENV_FILE}' -f docker-compose.prod.yml exec -T tabularium sh -c 'rm -rf /app/public/uploads/* && tar -xzf /tmp/tabularium-uploads.tar.gz -C /app/public/uploads --strip-components=1'; \
   fi; \
   \$COMPOSE --env-file '${ENV_FILE}' -f docker-compose.prod.yml ps"
