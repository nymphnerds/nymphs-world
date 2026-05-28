#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_nymphs_world_common.sh"

nymphs_world_ensure_dirs

if [[ ! -f "${NYMPHS_WORLD_MARKER_FILE}" ]]; then
  echo "ERROR: ${NYMPHS_WORLD_MODULE_NAME} is not installed. Run Install first." >&2
  exit 1
fi

if [[ ! -f "${NYMPHS_WORLD_SERVER_ENTRYPOINT}" ]]; then
  echo "ERROR: server entrypoint is missing: ${NYMPHS_WORLD_SERVER_ENTRYPOINT}" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required by the WORBI-based ${NYMPHS_WORLD_MODULE_NAME} runtime." >&2
  exit 1
fi

if [[ ! -d "${NYMPHS_WORLD_SERVER_DIR}/node_modules/express" && ! -d "${NYMPHS_WORLD_APP_DIR}/node_modules/express" ]]; then
  echo "ERROR: server dependencies are missing. Run Install or Update first." >&2
  exit 1
fi

if pid="$(nymphs_world_tracked_pid 2>/dev/null)"; then
  echo "${NYMPHS_WORLD_MODULE_NAME} is already running (PID: ${pid})"
  echo "url=${NYMPHS_WORLD_URL}"
  echo "module_ui_url=${NYMPHS_WORLD_URL}"
  exit 0
fi

if nymphs_world_health_ok; then
  pid="$(nymphs_world_find_server_pids | head -n 1 || true)"
  [[ -n "${pid}" ]] && echo "${pid}" > "${NYMPHS_WORLD_PID_FILE}"
  echo "${NYMPHS_WORLD_MODULE_NAME} is already responding."
  echo "url=${NYMPHS_WORLD_URL}"
  echo "module_ui_url=${NYMPHS_WORLD_URL}"
  exit 0
fi

echo "Starting ${NYMPHS_WORLD_MODULE_NAME}..."
(
  cd "${NYMPHS_WORLD_SERVER_DIR}"
  export PORT="${NYMPHS_WORLD_PORT}"
  export NYMPHS_WORLD_HOST="${NYMPHS_WORLD_HOST}"
  export NYMPHS_WORLD_MODULE_ID="${NYMPHS_WORLD_MODULE_ID}"
  export NYMPHS_WORLD_MODULE_NAME="${NYMPHS_WORLD_MODULE_NAME}"
  export NYMPHS_WORLD_DATA_ROOT="${NYMPHS_WORLD_DATA_ROOT}"
  export NYMPHS_WORLD_PROJECTS_ROOT="${NYMPHS_WORLD_PROJECTS_ROOT}"
  export NYMPHS_WORLD_USERS_ROOT="${NYMPHS_WORLD_USERS_ROOT}"
  export NYMPHS_WORLD_USERS_JSON="${NYMPHS_WORLD_USERS_JSON}"
  export NYMPHS_WORLD_USER_SETTINGS_DIR="${NYMPHS_WORLD_USER_SETTINGS_DIR}"
  export NYMPHS_WORLD_META_DIR="${NYMPHS_WORLD_META_DIR}"

  if command -v setsid >/dev/null 2>&1; then
    setsid -f bash -c 'printf "%s\n" "$$" > "$1"; exec node src/index.js > "$2" 2>&1' _ "${NYMPHS_WORLD_PID_FILE}" "${NYMPHS_WORLD_SERVER_LOG}"
  else
    nohup bash -c 'printf "%s\n" "$$" > "$1"; exec node src/index.js > "$2" 2>&1' _ "${NYMPHS_WORLD_PID_FILE}" "${NYMPHS_WORLD_SERVER_LOG}" >/dev/null 2>&1 &
  fi
)

pid=""
for _ in $(seq 1 20); do
  pid="$(cat "${NYMPHS_WORLD_PID_FILE}" 2>/dev/null || true)"
  [[ -n "${pid}" ]] && break
  sleep 0.1
done

for _ in $(seq 1 30); do
  if nymphs_world_health_ok; then
    echo "${NYMPHS_WORLD_MODULE_NAME} started (PID: ${pid})"
    echo "url=${NYMPHS_WORLD_URL}"
    echo "module_ui_url=${NYMPHS_WORLD_URL}"
    exit 0
  fi

  if [[ -n "${pid}" ]] && ! nymphs_world_pid_running "${pid}"; then
    echo "ERROR: ${NYMPHS_WORLD_MODULE_NAME} failed to start." >&2
    tail -80 "${NYMPHS_WORLD_SERVER_LOG}" >&2 || true
    exit 1
  fi

  sleep 1
done

echo "WARNING: ${NYMPHS_WORLD_MODULE_NAME} started but did not respond yet."
echo "url=${NYMPHS_WORLD_URL}"
echo "module_ui_url=${NYMPHS_WORLD_URL}"
echo "last_log=${NYMPHS_WORLD_SERVER_LOG}"
