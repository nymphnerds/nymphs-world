#!/usr/bin/env bash

NYMPHS_WORLD_MODULE_ID="nymphs-world"
NYMPHS_WORLD_MODULE_NAME="Nymphs World"
NYMPHS_WORLD_DEFAULT_PORT="8083"

NYMPHS_WORLD_INSTALL_DIR="${NYMPHS_WORLD_INSTALL_ROOT:-${NYMPHS_WORLD_INSTALL_DIR:-${HOME}/Nymphs-World}}"
NYMPHS_WORLD_DATA_ROOT="${NYMPHS_WORLD_DATA_ROOT:-${HOME}/NymphsData/nymphs-world}"
NYMPHS_WORLD_PROJECTS_ROOT="${NYMPHS_WORLD_PROJECTS_ROOT:-${NYMPHS_WORLD_DATA_ROOT}/projects}"
NYMPHS_WORLD_CONFIG_DIR="${NYMPHS_WORLD_CONFIG_DIR:-${HOME}/NymphsData/config/nymphs-world}"
NYMPHS_WORLD_LOGS_DIR="${NYMPHS_WORLD_LOGS_DIR:-${HOME}/NymphsData/logs/nymphs-world}"
NYMPHS_WORLD_HOST="${NYMPHS_WORLD_HOST:-127.0.0.1}"
NYMPHS_WORLD_PORT="${NYMPHS_WORLD_PORT:-${NYMPHS_WORLD_DEFAULT_PORT}}"
NYMPHS_WORLD_URL="http://${NYMPHS_WORLD_HOST}:${NYMPHS_WORLD_PORT}"
NYMPHS_WORLD_HEALTH_URL="${NYMPHS_WORLD_URL}/api/health"
NYMPHS_WORLD_SERVER_INFO_URL="${NYMPHS_WORLD_URL}/server_info"
NYMPHS_WORLD_MARKER_FILE="${NYMPHS_WORLD_INSTALL_DIR}/.nymph-module-version"
NYMPHS_WORLD_PID_FILE="${NYMPHS_WORLD_LOGS_DIR}/nymphs-world.pid"
NYMPHS_WORLD_SERVER_LOG="${NYMPHS_WORLD_LOGS_DIR}/nymphs-world-server.log"
NYMPHS_WORLD_APP_DIR="${NYMPHS_WORLD_INSTALL_DIR}/app"
NYMPHS_WORLD_SERVER_DIR="${NYMPHS_WORLD_APP_DIR}/server"
NYMPHS_WORLD_SERVER_ENTRYPOINT="${NYMPHS_WORLD_SERVER_DIR}/src/index.js"
NYMPHS_WORLD_USERS_ROOT="${NYMPHS_WORLD_USERS_ROOT:-${NYMPHS_WORLD_DATA_ROOT}/users}"
NYMPHS_WORLD_USERS_JSON="${NYMPHS_WORLD_USERS_JSON:-${NYMPHS_WORLD_CONFIG_DIR}/users.json}"
NYMPHS_WORLD_USER_SETTINGS_DIR="${NYMPHS_WORLD_USER_SETTINGS_DIR:-${NYMPHS_WORLD_CONFIG_DIR}/user-settings}"
NYMPHS_WORLD_META_DIR="${NYMPHS_WORLD_META_DIR:-${NYMPHS_WORLD_DATA_ROOT}/.worbi-meta}"

export PATH="${HOME}/.local/bin:${PATH}"

nymphs_world_ensure_dirs() {
  mkdir -p "${NYMPHS_WORLD_DATA_ROOT}" \
    "${NYMPHS_WORLD_PROJECTS_ROOT}" \
    "${NYMPHS_WORLD_CONFIG_DIR}" \
    "${NYMPHS_WORLD_LOGS_DIR}" \
    "${NYMPHS_WORLD_USERS_ROOT}" \
    "${NYMPHS_WORLD_USER_SETTINGS_DIR}" \
    "${NYMPHS_WORLD_META_DIR}"
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
  local server_dir_resolved install_dir_resolved
  server_dir_resolved="$(readlink -f "${NYMPHS_WORLD_SERVER_DIR}" 2>/dev/null || true)"
  install_dir_resolved="$(readlink -f "${NYMPHS_WORLD_INSTALL_DIR}" 2>/dev/null || true)"

  while read -r pid args; do
    [[ -n "${pid}" ]] || continue
    local cwd
    cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
    if [[ -n "${server_dir_resolved}" && "${cwd}" == "${server_dir_resolved}" ]] ||
      [[ -n "${install_dir_resolved}" && "${args}" == *"${install_dir_resolved}/app/server/src/index.js"* ]] ||
      [[ -n "${server_dir_resolved}" && "${args}" == *"${server_dir_resolved}/src/index.js"* ]] ||
      [[ "${args}" == *"node"* && "${args}" == *"src/index.js"* && "${args}" == *"nymphs-world"* ]]; then
      printf '%s\n' "${pid}"
    fi
  done < <(ps -eo pid=,args= 2>/dev/null | awk '/node/ {print $0}')
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

nymphs_world_codex_bin() {
  command -v codex 2>/dev/null || true
}

nymphs_world_codex_version() {
  local codex_bin="$1"
  [[ -n "${codex_bin}" ]] || return 1
  "${codex_bin}" --version 2>/dev/null | sed 's/^codex-cli[[:space:]]*//'
}

nymphs_world_codex_logged_in() {
  local codex_bin="$1"
  [[ -n "${codex_bin}" ]] || return 1
  "${codex_bin}" login status 2>&1 | grep -qi 'logged in using chatgpt'
}

nymphs_world_codex_app_server_ready() {
  local codex_bin="$1"
  [[ -n "${codex_bin}" ]] || return 1
  "${codex_bin}" app-server daemon version >/dev/null 2>&1
}
