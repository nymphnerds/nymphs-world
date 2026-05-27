#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_nymphs_world_common.sh"

nymphs_world_ensure_dirs
touch "${NYMPHS_WORLD_SERVER_LOG}"

echo "logs_dir=${NYMPHS_WORLD_LOGS_DIR}"
echo "last_log=${NYMPHS_WORLD_SERVER_LOG}"
echo "server_log=${NYMPHS_WORLD_SERVER_LOG}"

echo ""
echo "== server =="
tail -120 "${NYMPHS_WORLD_SERVER_LOG}" || true
