#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_nymphs_world_common.sh"

started_by_test=false
if ! nymphs_world_health_ok; then
  "${SCRIPT_DIR}/nymphs_world_start.sh"
  started_by_test=true
fi

if ! nymphs_world_health_ok; then
  echo "SMOKE TEST FAILED"
  echo "ERROR: health endpoint did not answer: ${NYMPHS_WORLD_HEALTH_URL}" >&2
  [[ "${started_by_test}" == "true" ]] && "${SCRIPT_DIR}/nymphs_world_stop.sh" || true
  exit 1
fi

server_info="$(curl --max-time 2 -fsS "${NYMPHS_WORLD_SERVER_INFO_URL}")"

echo "SMOKE TEST PASSED"
echo "SUCCESS: ${NYMPHS_WORLD_MODULE_NAME} answered health and server_info."
echo "url=${NYMPHS_WORLD_URL}"
echo "server_info=${server_info}"

if [[ "${started_by_test}" == "true" ]]; then
  "${SCRIPT_DIR}/nymphs_world_stop.sh"
fi
