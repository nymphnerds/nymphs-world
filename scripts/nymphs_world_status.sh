#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_nymphs_world_common.sh"

installed=false
runtime_present=false
data_present=false
version=not-installed
running=false
state=available
health=unavailable
python_ready=false
detail="${NYMPHS_WORLD_MODULE_NAME} is not installed."

if command -v python3 >/dev/null 2>&1; then
  python_ready=true
fi

if [[ -f "${NYMPHS_WORLD_MARKER_FILE}" ]]; then
  installed=true
  runtime_present=true
  version="$(head -n 1 "${NYMPHS_WORLD_MARKER_FILE}" 2>/dev/null || true)"
  [[ -n "${version}" ]] || version=unknown
fi

if [[ -d "${NYMPHS_WORLD_DATA_ROOT}" || -d "${NYMPHS_WORLD_PROJECTS_ROOT}" || -d "${NYMPHS_WORLD_CONFIG_DIR}" || -d "${NYMPHS_WORLD_LOGS_DIR}" ]]; then
  data_present=true
fi

if pid="$(nymphs_world_tracked_pid 2>/dev/null)"; then
  running=true
elif [[ "${installed}" == "true" ]]; then
  pid="$(nymphs_world_find_server_pids | head -n 1 || true)"
  if [[ -n "${pid}" ]]; then
    running=true
  fi
fi

if [[ "${installed}" == "true" && "${python_ready}" == "false" ]]; then
  state=needs_attention
  health=degraded
  detail="${NYMPHS_WORLD_MODULE_NAME} is installed, but python3 is missing."
elif [[ "${installed}" == "true" && "${running}" == "true" ]]; then
  state=running
  if nymphs_world_health_ok; then
    health=ok
    detail="${NYMPHS_WORLD_MODULE_NAME} is running."
  else
    health=unreachable
    detail="${NYMPHS_WORLD_MODULE_NAME} has a process, but the health endpoint did not answer."
  fi
elif [[ "${installed}" == "true" ]]; then
  state=installed
  health=ok
  detail="${NYMPHS_WORLD_MODULE_NAME} is installed but stopped."
elif [[ "${data_present}" == "true" ]]; then
  detail="${NYMPHS_WORLD_MODULE_NAME} data remains, but runtime files are not installed."
fi

cat <<STATUS
id=nymphs-world
installed=${installed}
runtime_present=${runtime_present}
data_present=${data_present}
version=${version}
python_ready=${python_ready}
running=${running}
state=${state}
health=${health}
install_root=${NYMPHS_WORLD_INSTALL_DIR}
data_root=${NYMPHS_WORLD_DATA_ROOT}
projects_root=${NYMPHS_WORLD_PROJECTS_ROOT}
logs_dir=${NYMPHS_WORLD_LOGS_DIR}
last_log=${NYMPHS_WORLD_SERVER_LOG}
marker=${NYMPHS_WORLD_MARKER_FILE}
url=${NYMPHS_WORLD_URL}
frontend_url=${NYMPHS_WORLD_URL}
backend_url=${NYMPHS_WORLD_URL}
health_url=${NYMPHS_WORLD_HEALTH_URL}
detail=${detail}
STATUS
