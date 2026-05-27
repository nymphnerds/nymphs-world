#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_nymphs_world_common.sh"

nymphs_world_ensure_dirs
echo "directory=${NYMPHS_WORLD_PROJECTS_ROOT}"
echo "path=${NYMPHS_WORLD_PROJECTS_ROOT}"
