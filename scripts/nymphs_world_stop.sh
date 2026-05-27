#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_nymphs_world_common.sh"

stop_pid() {
  local pid="$1"
  nymphs_world_pid_running "${pid}" || return 0

  echo "Stopping ${NYMPHS_WORLD_MODULE_NAME} (PID: ${pid})..."
  kill "${pid}" >/dev/null 2>&1 || true

  for _ in $(seq 1 20); do
    if ! nymphs_world_pid_running "${pid}"; then
      return 0
    fi
    sleep 0.25
  done

  kill -KILL "${pid}" >/dev/null 2>&1 || true
}

pids=()
if [[ -f "${NYMPHS_WORLD_PID_FILE}" ]]; then
  pid="$(cat "${NYMPHS_WORLD_PID_FILE}" 2>/dev/null || true)"
  if nymphs_world_pid_running "${pid}"; then
    pids+=("${pid}")
  fi
fi

while IFS= read -r pid; do
  [[ -n "${pid}" ]] || continue
  pids+=("${pid}")
done < <(nymphs_world_find_server_pids)

while IFS= read -r pid; do
  [[ -n "${pid}" ]] || continue
  pids+=("${pid}")
done < <(nymphs_world_find_port_pids)

unique_pids=()
for pid in "${pids[@]}"; do
  seen=false
  for existing in "${unique_pids[@]}"; do
    if [[ "${existing}" == "${pid}" ]]; then
      seen=true
      break
    fi
  done
  if [[ "${seen}" == "false" ]]; then
    unique_pids+=("${pid}")
  fi
done

if [[ "${#unique_pids[@]}" -eq 0 ]]; then
  rm -f "${NYMPHS_WORLD_PID_FILE}"
  echo "${NYMPHS_WORLD_MODULE_NAME} is not running."
  exit 0
fi

for pid in "${unique_pids[@]}"; do
  stop_pid "${pid}"
done

rm -f "${NYMPHS_WORLD_PID_FILE}"

for _ in $(seq 1 20); do
  if ! nymphs_world_health_ok; then
    echo "${NYMPHS_WORLD_MODULE_NAME} stopped."
    exit 0
  fi
  sleep 0.25
done

echo "ERROR: ${NYMPHS_WORLD_MODULE_NAME} still responds after stop." >&2
exit 1
