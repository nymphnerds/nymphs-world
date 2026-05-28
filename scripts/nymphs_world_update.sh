#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_nymphs_world_common.sh"

if [[ ! -f "${NYMPHS_WORLD_MARKER_FILE}" ]]; then
  echo "${NYMPHS_WORLD_MODULE_NAME} is not installed yet. Use Install first." >&2
  exit 2
fi

module_version="$(nymphs_world_version_from_manifest "${MODULE_ROOT}/nymph.json")"

install_file_if_different() {
  local mode="$1"
  local source_file="$2"
  local destination_file="$3"
  local source_resolved destination_resolved
  source_resolved="$(readlink -f "${source_file}" 2>/dev/null || true)"
  destination_resolved="$(readlink -f "${destination_file}" 2>/dev/null || true)"
  if [[ -n "${source_resolved}" && -n "${destination_resolved}" && "${source_resolved}" == "${destination_resolved}" ]]; then
    return 0
  fi
  install -m "${mode}" "${source_file}" "${destination_file}"
}

rm -f "${NYMPHS_WORLD_INSTALL_DIR}/nymphs_world_server.py"
rm -rf "${NYMPHS_WORLD_INSTALL_DIR}/ui"

mkdir -p "${NYMPHS_WORLD_INSTALL_DIR}/scripts"
mkdir -p "${NYMPHS_WORLD_INSTALL_DIR}/app"
install_file_if_different 644 "${MODULE_ROOT}/nymph.json" "${NYMPHS_WORLD_INSTALL_DIR}/nymph.json"
install_file_if_different 644 "${MODULE_ROOT}/README.md" "${NYMPHS_WORLD_INSTALL_DIR}/README.md"
for script_file in "${MODULE_ROOT}/scripts/"*.sh; do
  install_file_if_different 755 "${script_file}" "${NYMPHS_WORLD_INSTALL_DIR}/scripts/$(basename "${script_file}")"
done
cp -a "${MODULE_ROOT}/app/." "${NYMPHS_WORLD_INSTALL_DIR}/app/"
rm -rf "${NYMPHS_WORLD_INSTALL_DIR}/app/node_modules" \
  "${NYMPHS_WORLD_INSTALL_DIR}/app/server/node_modules" \
  "${NYMPHS_WORLD_INSTALL_DIR}/app/client/node_modules" \
  "${NYMPHS_WORLD_INSTALL_DIR}/app/client/dist"

if command -v npm >/dev/null 2>&1; then
  if [[ ! -d "${NYMPHS_WORLD_SERVER_DIR}/node_modules/express" && ! -d "${NYMPHS_WORLD_APP_DIR}/node_modules/express" ]]; then
    echo "Installing missing production server dependencies..."
    (cd "${NYMPHS_WORLD_SERVER_DIR}" && npm install --omit=dev --no-audit --no-fund --loglevel=warn)
  fi
else
  echo "WARNING: npm is missing; skipped dependency verification." >&2
fi

printf '%s\n' "${module_version}" > "${NYMPHS_WORLD_MARKER_FILE}"

echo "${NYMPHS_WORLD_MODULE_NAME} module wrappers updated."
echo "installed_version=${module_version}"
