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

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required by the NymphsCore base runtime." >&2
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
  cd "${NYMPHS_WORLD_INSTALL_DIR}"
  nohup python3 "${NYMPHS_WORLD_SERVER_ENTRYPOINT}" \
    --host "${NYMPHS_WORLD_HOST}" \
    --port "${NYMPHS_WORLD_PORT}" \
    --projects-root "${NYMPHS_WORLD_PROJECTS_ROOT}" \
    --ui-root "${NYMPHS_WORLD_INSTALL_DIR}/ui" \
    > "${NYMPHS_WORLD_SERVER_LOG}" 2>&1 &
  echo "$!" > "${NYMPHS_WORLD_PID_FILE}"
)

pid="$(cat "${NYMPHS_WORLD_PID_FILE}" 2>/dev/null || true)"
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
