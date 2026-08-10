#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="./deploy.conf"
OUTPUT_DIR="./resources/backups"
SERVER_HOST=""
SERVER_USER=""
SSH_KEY=""
DB_CONTAINER="tabularium-db"

usage() {
  cat <<'USAGE'
Uso:
  .devops/db-backup-production.sh [opzioni]

Opzioni:
  -o, --output-dir PATH   Directory locale in cui salvare il dump.
                          Default: ./backups
  --config PATH           File di configurazione.
                          Default: ./deploy.conf
  --server-host HOST      Host del server di produzione.
  --server-user USER      Utente SSH.
  --ssh-key PATH          Chiave privata SSH.
  -h, --help              Mostra questo aiuto.

Lo script richiede sempre una conferma esplicita prima di avviare il backup.

Esempi:
  .devops/db-backup-production.sh
  .devops/db-backup-production.sh --output-dir ./resources/backups
  .devops/db-backup-production.sh -o /mnt/backups/tabularium
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

# Il file di configurazione va individuato prima di leggere gli altri override.
while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      require_value "$1" "${2:-}"
      CONFIG_FILE="$2"
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
  echo "File di configurazione non trovato: ${CONFIG_FILE}" >&2
  exit 1
fi

set -- "${args[@]}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output-dir)
      require_value "$1" "${2:-}"
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --config)
      shift 2
      ;;
    --server-host)
      require_value "$1" "${2:-}"
      SERVER_HOST="$2"
      shift 2
      ;;
    --server-user)
      require_value "$1" "${2:-}"
      SERVER_USER="$2"
      shift 2
      ;;
    --ssh-key)
      require_value "$1" "${2:-}"
      SSH_KEY="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opzione non riconosciuta: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${SERVER_HOST}" || -z "${SERVER_USER}" || -z "${SSH_KEY}" ]]; then
  echo "SERVER_HOST, SERVER_USER e SSH_KEY devono essere configurati." >&2
  exit 1
fi

if [[ ! -f "${SSH_KEY}" ]]; then
  echo "Chiave SSH non trovata: ${SSH_KEY}" >&2
  exit 1
fi

timestamp="$(date '+%Y%m%d-%H%M%S')"
filename="tabularium-production-${timestamp}.dump"
destination="${OUTPUT_DIR%/}/${filename}"
partial="${destination}.partial"

echo "Backup database di produzione"
echo "Server:      ${SERVER_USER}@${SERVER_HOST}"
echo "Container:   ${DB_CONTAINER}"
echo "Destinazione: ${destination}"
echo

if ! read -r -p "Confermi l'esecuzione del backup? [s/N] " confirmation; then
  echo
  echo "Backup annullato."
  exit 1
fi

case "${confirmation,,}" in
  s|si|sì|y|yes) ;;
  *)
    echo "Backup annullato."
    exit 0
    ;;
esac

mkdir -p "${OUTPUT_DIR}"
trap 'rm -f "${partial}"' EXIT

echo "Creazione del dump in corso..."
ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_HOST}" \
  "docker exec '${DB_CONTAINER}' sh -lc 'pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc'" \
  > "${partial}"

if [[ ! -s "${partial}" ]]; then
  echo "Il dump generato è vuoto." >&2
  exit 1
fi

mv "${partial}" "${destination}"
chmod 600 "${destination}"
trap - EXIT

echo "Backup completato: ${destination}"
ls -lh "${destination}"
