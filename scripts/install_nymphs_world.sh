#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_nymphs_world_common.sh"

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required by the NymphsCore base runtime." >&2
  exit 1
fi

module_version="$(nymphs_world_version_from_manifest "${REPO_DIR}/nymph.json")"
install_parent="$(dirname "${NYMPHS_WORLD_INSTALL_DIR}")"
mkdir -p "${install_parent}"
staging_dir="$(mktemp -d "${install_parent}/.nymphs-world-install.XXXXXX")"
cleanup() {
  rm -rf "${staging_dir}"
}
trap cleanup EXIT

echo "Installing ${NYMPHS_WORLD_MODULE_NAME} ${module_version}..."
echo "install_root=${NYMPHS_WORLD_INSTALL_DIR}"

install -m 644 "${REPO_DIR}/nymph.json" "${staging_dir}/nymph.json"
install -m 644 "${REPO_DIR}/README.md" "${staging_dir}/README.md"
install -m 755 "${REPO_DIR}/nymphs_world_server.py" "${staging_dir}/nymphs_world_server.py"

mkdir -p "${staging_dir}/scripts" "${staging_dir}/ui"
install -m 755 "${REPO_DIR}/scripts/"*.sh "${staging_dir}/scripts/"
install -m 644 "${REPO_DIR}/ui/index.html" "${staging_dir}/ui/index.html"

nymphs_world_ensure_dirs

rm -rf "${NYMPHS_WORLD_INSTALL_DIR}"
mv "${staging_dir}" "${NYMPHS_WORLD_INSTALL_DIR}"
trap - EXIT

printf '%s\n' "${module_version}" > "${NYMPHS_WORLD_MARKER_FILE}"
echo "installed_module_version=${module_version}"
echo "${NYMPHS_WORLD_MODULE_NAME} installed."
