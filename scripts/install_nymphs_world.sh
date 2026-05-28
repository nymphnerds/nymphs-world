#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_nymphs_world_common.sh"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required. Install WORBI or the NymphsCore Node runtime first." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm is required to install ${NYMPHS_WORLD_MODULE_NAME} server dependencies." >&2
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

if [[ -f "${NYMPHS_WORLD_MARKER_FILE}" ]]; then
  "${SCRIPT_DIR}/nymphs_world_stop.sh" >/dev/null 2>&1 || true
fi

install -m 644 "${REPO_DIR}/nymph.json" "${staging_dir}/nymph.json"
install -m 644 "${REPO_DIR}/README.md" "${staging_dir}/README.md"

mkdir -p "${staging_dir}/scripts"
install -m 755 "${REPO_DIR}/scripts/"*.sh "${staging_dir}/scripts/"
cp -a "${REPO_DIR}/app" "${staging_dir}/app"
rm -rf "${staging_dir}/app/node_modules" \
  "${staging_dir}/app/server/node_modules" \
  "${staging_dir}/app/client/node_modules" \
  "${staging_dir}/app/client/dist"

nymphs_world_ensure_dirs

rm -rf "${NYMPHS_WORLD_INSTALL_DIR}"
mv "${staging_dir}" "${NYMPHS_WORLD_INSTALL_DIR}"
trap - EXIT

echo "Installing production server dependencies..."
(
  cd "${NYMPHS_WORLD_SERVER_DIR}"
  npm install --omit=dev --no-audit --no-fund --loglevel=warn
)

printf '%s\n' "${module_version}" > "${NYMPHS_WORLD_MARKER_FILE}"
echo "installed_module_version=${module_version}"
echo "${NYMPHS_WORLD_MODULE_NAME} installed."
