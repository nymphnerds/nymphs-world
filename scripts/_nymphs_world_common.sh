#!/usr/bin/env bash

NYMPHS_WORLD_MODULE_ID="nymphs-world"
NYMPHS_WORLD_MODULE_NAME="Nymphs World"
NYMPHS_WORLD_DEFAULT_PORT="8098"

NYMPHS_WORLD_INSTALL_DIR="${NYMPHS_WORLD_INSTALL_ROOT:-${NYMPHS_WORLD_INSTALL_DIR:-${HOME}/Nymphs-World}}"
NYMPHS_WORLD_DATA_ROOT="${NYMPHS_WORLD_DATA_ROOT:-${HOME}/NymphsData/nymphs-world}"
NYMPHS_WORLD_PROJECTS_ROOT="${NYMPHS_WORLD_PROJECTS_ROOT:-${NYMPHS_WORLD_DATA_ROOT}/projects}"
NYMPHS_WORLD_CONFIG_DIR="${NYMPHS_WORLD_CONFIG_DIR:-${HOME}/NymphsData/config/nymphs-world}"
NYMPHS_WORLD_LOGS_DIR="${NYMPHS_WORLD_LOGS_DIR:-${HOME}/NymphsData/logs/nymphs-world}"
NYMPHS_WORLD_HOST="${NYMPHS_WORLD_HOST:-127.0.0.1}"
NYMPHS_WORLD_PORT="${NYMPHS_WORLD_PORT:-${NYMPHS_WORLD_DEFAULT_PORT}}"
NYMPHS_WORLD_URL="http://${NYMPHS_WORLD_HOST}:${NYMPHS_WORLD_PORT}"
NYMPHS_WORLD_HEALTH_URL="${NYMPHS_WORLD_URL}/health"
NYMPHS_WORLD_SERVER_INFO_URL="${NYMPHS_WORLD_URL}/server_info"
NYMPHS_WORLD_MARKER_FILE="${NYMPHS_WORLD_INSTALL_DIR}/.nymph-module-version"
NYMPHS_WORLD_PID_FILE="${NYMPHS_WORLD_LOGS_DIR}/nymphs-world.pid"
NYMPHS_WORLD_SERVER_LOG="${NYMPHS_WORLD_LOGS_DIR}/nymphs-world-server.log"
NYMPHS_WORLD_SERVER_ENTRYPOINT="${NYMPHS_WORLD_INSTALL_DIR}/nymphs_world_server.py"

nymphs_world_ensure_dirs() {
  mkdir -p "${NYMPHS_WORLD_DATA_ROOT}" \
    "${NYMPHS_WORLD_PROJECTS_ROOT}" \
    "${NYMPHS_WORLD_CONFIG_DIR}" \
    "${NYMPHS_WORLD_LOGS_DIR}"
}

nymphs_world_pid_running() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1
}

nymphs_world_tracked_pid() {
  [[ -f "${NYMPHS_WORLD_PID_FILE}" ]] || return 1
  local pid
  pid="$(cat "${NYMPHS_WORLD_PID_FILE}" 2>/dev/null || true)"
  nymphs_world_pid_running "${pid}" || return 1
  printf '%s\n' "${pid}"
}

nymphs_world_health_ok() {
  curl --max-time 2 -fsS "${NYMPHS_WORLD_HEALTH_URL}" >/dev/null 2>&1
}

nymphs_world_find_server_pids() {
  local install_dir_resolved
  install_dir_resolved="$(readlink -f "${NYMPHS_WORLD_INSTALL_DIR}" 2>/dev/null || true)"

  while read -r pid args; do
    [[ -n "${pid}" ]] || continue
    if [[ -n "${install_dir_resolved}" && "${args}" == *"${install_dir_resolved}/nymphs_world_server.py"* ]]; then
      printf '%s\n' "${pid}"
    fi
  done < <(ps -eo pid=,args= 2>/dev/null | awk '/nymphs_world_server.py/ {print $0}')
}

nymphs_world_find_port_pids() {
  if command -v ss >/dev/null 2>&1; then
    ss -H -ltnp "sport = :${NYMPHS_WORLD_PORT}" 2>/dev/null \
      | sed -n 's/.*pid=\([0-9]\+\).*/\1/p'
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:${NYMPHS_WORLD_PORT}" -sTCP:LISTEN 2>/dev/null || true
  fi

  if command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "${NYMPHS_WORLD_PORT}" 2>/dev/null || true
  fi
}

nymphs_world_version_from_manifest() {
  python3 - "$1" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    manifest = json.load(handle)

print(str(manifest.get("version", "unknown")).strip() or "unknown")
PY
}
