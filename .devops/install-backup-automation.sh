#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/app/tabularium}"
CONFIG_FILE="${CONFIG_FILE:-${PROJECT_DIR}/backup.conf}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
SERVICE_NAME="${SERVICE_NAME:-tabularium-backup}"
ENABLE_TIMER="${ENABLE_TIMER:-1}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --project-dir) PROJECT_DIR="${2:?Missing value}"; shift 2 ;;
    --config-file) CONFIG_FILE="${2:?Missing value}"; shift 2 ;;
    --systemd-dir) SYSTEMD_DIR="${2:?Missing value}"; shift 2 ;;
    --service-name) SERVICE_NAME="${2:?Missing value}"; shift 2 ;;
    --no-enable) ENABLE_TIMER=0; shift ;;
    -h|--help)
      echo "Usage: $0 [--project-dir DIR] [--config-file FILE] [--service-name NAME] [--no-enable]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "Run this installer as root" >&2; exit 1; }
[ -f "$CONFIG_FILE" ] || { echo "backup.conf not found: $CONFIG_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG_FILE"
BACKUP_ON_CALENDAR="${BACKUP_ON_CALENDAR:-*-*-* 02:30:00}"
BACKUP_RANDOMIZED_DELAY="${BACKUP_RANDOMIZED_DELAY:-10m}"
SOURCE_DIR="${PROJECT_DIR}/.devops/systemd"

sed \
  -e "s|WorkingDirectory=/app/tabularium|WorkingDirectory=${PROJECT_DIR}|" \
  -e "s|ExecStart=/app/tabularium/scripts/backup-prod.sh --config /app/tabularium/backup.conf|ExecStart=${PROJECT_DIR}/scripts/backup-prod.sh --config ${CONFIG_FILE}|" \
  "${SOURCE_DIR}/tabularium-backup.service" > "${SYSTEMD_DIR}/${SERVICE_NAME}.service"
sed \
  -e "s|Unit=tabularium-backup.service|Unit=${SERVICE_NAME}.service|" \
  -e "s|OnCalendar=\\*-\\*-\\* 02:30:00|OnCalendar=${BACKUP_ON_CALENDAR}|" \
  -e "s|RandomizedDelaySec=10m|RandomizedDelaySec=${BACKUP_RANDOMIZED_DELAY}|" \
  "${SOURCE_DIR}/tabularium-backup.timer" > "${SYSTEMD_DIR}/${SERVICE_NAME}.timer"

systemctl daemon-reload
if [ "$ENABLE_TIMER" -eq 1 ]; then
  systemctl enable --now "${SERVICE_NAME}.timer"
fi
systemctl status "${SERVICE_NAME}.timer" --no-pager || true
