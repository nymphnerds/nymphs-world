# WORBI Skill — Packaging for Distribution via GitHub Module Registry

Use this skill when you need to rebuild the WORBI distribution package and publish it to GitHub so NymphsCore Manager can discover, install, and manage it.

---

## 0. When to Use This Skill

**This is NOT run on every code change.** Only trigger the release workflow when:
- A stable feature set has been developed and tested in dev mode
- The user explicitly requests a production package/release
- You're preparing to push a new version to the GitHub module registry

---

## 0.2 Production Symlink Quick Reference (READ FIRST)

WORBI's Express server resolves frontend at `path.resolve(__dirname, '../dist')` = `server/dist/`. The installer places dist at `~/worbi/dist/` (top-level), so a **symlink is required**:

```
~/worbi/server/dist -> ~/worbi/dist
```

**Without this symlink:** Server logs "Frontend dist/ not found — API-only mode" and returns `Cannot GET /` (404).

**Verify symlink exists:**
```bash
test -L ~/worbi/server/dist && echo "SYMLINK OK" || echo "SYMLINK MISSING"
```

**Fix if missing:**
```bash
ln -sf ~/worbi/dist ~/worbi/server/dist
```

**Verify bundle served matches build (ALWAYS after deploy):**
```bash
SERVED=$(curl -sf http://localhost:8082/ | grep -o 'index-[A-Za-z0-9]\+\.js' | head -1)
BUILT=$(grep -o 'index-[A-Za-z0-9]\+\.js' ~/worbi/dist/index.html | head -1)
[[ "$SERVED" == "$BUILT" ]] && echo "BUNDLE MATCH OK" || echo "BUNDLE MISMATCH"
```

**Important:** The `worbi-start` script (v6.2.52+) auto-creates the symlink if missing. But after manual dist updates or package installs, verify it still exists.

---

## 0.5 Full Release Workflow (End-to-End)

Use this sequence when releasing a new production version of WORBI:

### Phase 1: Prepare
1. **Bump version** in `Nymphs-Brain/WORBI/package.json` (increment patch version)
2. **Verify all source code changes are complete** — the fix/feature is in `client/src/` and `server/src/`

### Phase 2: Build Production Client
3. Run `npm run build` in `Nymphs-Brain/WORBI/client/` — this compiles TypeScript + bundles with Vite into `client/dist/`
4. **Verify the fix is in bundle:** `grep -c "identifier" client/dist/assets/index-*.js`

### Phase 3: Package (Steps 1-11 below)
5. Follow the Build Process steps 1-11 to create the archive
6. **CRITICAL:** After rsync, remove `server/dist` from staging: `rm -rf /tmp/worbi-package-staging/worbi/server/dist`

### Phase 4: Publish
7. Update `~/worbi/nymph.json` with new version and archive filename
8. Commit archive + nymph.json to `~/worbi`, push to GitHub (requires PAT — see worbi-github skill)
9. Commit version bump to `Nymphs-Brain/WORBI`, push to GitHub

### Phase 5: Deploy Locally for Testing

**Option A — Simulate Manager Update (PREFERRED):**
On a real user's machine, the installer installs to `~/worbi` by default:
```bash
# 1. Stop current server
worbi-stop

# 2. Run installer (handles backup, dist copy, symlink, user data restore)
bash ~/worbi/scripts/install_worbi.sh
```

**Option B — Local Dev Machine Simulation (Dev Machine Only):**
On this dev machine, `~/worbi` is the git repo, so use `WORBI_INSTALL_DIR` to redirect to `~/worbi-prod`:
```bash
# 1. Stop current server
WORBI_INSTALL_DIR=~/worbi-prod worbi-stop

# 2. Run installer (redirected to ~/worbi-prod)
WORBI_INSTALL_DIR=~/worbi-prod bash ~/worbi/scripts/install_worbi.sh

# 3. Start server
WORBI_INSTALL_DIR=~/worbi-prod worbi-start

# 4. Verify bundle matches
SERVED=$(curl -sf http://localhost:8082/ | grep -o 'index-[A-Za-z0-9]\+\.js' | head -1)
BUILT=$(grep -o 'index-[A-Za-z0-9]\+\.js' ~/worbi-prod/dist/index.html | head -1)
[[ "$SERVED" == "$BUILT" ]] && echo "BUNDLE MATCH OK" || echo "BUNDLE MISMATCH"
```

**Option C — Manual Local Development Deployment (Without Package):**
```bash
# 1. Stop server
WORBI_INSTALL_DIR=~/worbi-prod worbi-stop

# 2. Rebuild client
cd Nymphs-Brain/WORBI/client && npm run build

# 3. Copy new dist
rm -rf ~/worbi-prod/dist && cp -r Nymphs-Brain/WORBI/client/dist ~/worbi-prod/dist

# 4. Fix symlink (worbi-start does this auto but verify)
test -L ~/worbi-prod/server/dist && echo "SYMLINK OK" || ln -sf ~/worbi-prod/dist ~/worbi-prod/server/dist

# 5. Start server
WORBI_INSTALL_DIR=~/worbi-prod worbi-start

# 6. Verify bundle matches
SERVED=$(curl -sf http://localhost:8082/ | grep -o 'index-[A-Za-z0-9]\+\.js' | head -1)
BUILT=$(grep -o 'index-[A-Za-z0-9]\+\.js' ~/worbi-prod/dist/index.html | head -1)
[[ "$SERVED" == "$BUILT" ]] && echo "OK" || echo "MISMATCH"
```

**NEVER use `mv ~/worbi ~/worbi-backup`** — see CAVEAT 14.

### Phase 6: Post-Release (After User Testing)
1. **Wait for user confirmation** that changes work correctly
2. Update `CHANGELOG.md` with new version entry
3. Update `update_record.md` with details
4. Add tests to `client/tests` and `server/tests` if the feature requires testing

### Summary Flow
```
Bump version → Build client → Stage archive → Remove server/dist from staging → Remove user data → Write bin scripts → Build tar.gz → Verify archive → Update nymph.json → Push GitHub → Run installer → Verify symlink → Verify bundle hash → Test → Changelog
```

---

## 1. Package Overview

| Attribute | Value |
|-----------|-------|
| **Source Path** | `Nymphs-Brain/WORBI/` (relative to `/home/rauty`) |
| **Module Repo** | `~/worbi/` (cloned from `github.com/nymphnerds/worbi`) |
| **Registry Repo** | `~/rautys-registry/` (cloned from `github.com/rautynerds/rautys-registry`) |
| **Archive Name** | `worbi-{VERSION}.tar.gz` (version from source `package.json`) |
| **Archive Location** | `~/worbi/packages/worbi-{VERSION}.tar.gz` |
| **Manifest** | `~/worbi/nymph.json` (describes module to NymphsCore Manager) |
| **Server Port** | 8082 (single production server, no dev servers) |
| **Install Root** | `~/worbi` (where the archive extracts to on a user's machine) |

### Archive Contents (inside tar.gz):
```
worbi/
  dist/                  # Pre-built React frontend (from npm run build)
  server/
    src/                 # Express server source
      data/              # Empty on install (users, user-settings subdirs)
    package.json         # Server dependencies
  bin/
    worbi-start          # Production start script
    worbi-stop           # Production stop script
    worbi-status         # Status / contract output
  package.json           # Root package.json (version reference)
```

**Excluded from archive:** TypeScript source, test files, dev dependencies, `.git`, build configs, user data, `server/dist/` (created as symlink by installer), `node_modules/`

### Module Repo Structure (`~/worbi/`):
```
packages/
  worbi-{VERSION}.tar.gz  # Production archive
nymph.json               # Module manifest for NymphsCore Manager
README.md
docs/
  NOTE_TO_LLM_ABOUT_WORBI_SYMLINK.md  # Installer caveats reference
scripts/                # Manager-facing wrapper scripts
   install_worbi.sh      # Extract archive + install to ~/worbi (default) or $WORBI_INSTALL_DIR
  installer_from_package.sh  # Internal installer (dist copy + symlink + user data restore)
  worbi_status.sh       # Return parseable status fields
  worbi_start.sh        # Start production server
  worbi_stop.sh         # Stop server
  worbi_open.sh         # Open frontend URL
  worbi_logs.sh         # Show log paths
  worbi_uninstall.sh    # Remove installed WORBI
```

---

## 2. Build Process (Step-by-Step)

### Step 1: Get version and prepare staging
```bash
VERSION=$(node -p "require('/home/rauty/Nymphs-Brain/WORBI/package.json').version")
rm -rf /tmp/worbi-package-staging
mkdir -p /tmp/worbi-package-staging/worbi/{dist,server,bin}
```

### Step 2: Build client production
```bash
cd /home/rauty/Nymphs-Brain/WORBI/client
npm run build
rsync -a dist/ /tmp/worbi-package-staging/worbi/dist/
```

### Step 3: Copy server production files
```bash
cd /home/rauty/Nymphs-Brain/WORBI
rsync -a --exclude='node_modules' --exclude='tests' --exclude='test' server/ /tmp/worbi-package-staging/worbi/server/
cp server/package.json /tmp/worbi-package-staging/worbi/
```

### Step 4: Remove user data (CRITICAL)
```bash
rm -rf /tmp/worbi-package-staging/worbi/server/src/data/users
rm -f /tmp/worbi-package-staging/worbi/server/src/data/users.json
```

### Step 5: Remove server/dist from staging (CRITICAL)
```bash
# server/dist must NOT be in the archive — it's a symlink created by the installer
rm -rf /tmp/worbi-package-staging/worbi/server/dist
```

### Step 6: Write production bin scripts
Copy updated bin scripts from `Nymphs-Brain/bin/`:
```bash
cp /home/rauty/Nymphs-Brain/bin/worbi-start /tmp/worbi-package-staging/worbi/bin/
cp /home/rauty/Nymphs-Brain/bin/worbi-stop /tmp/worbi-package-staging/worbi/bin/
cp /home/rauty/Nymphs-Brain/bin/worbi-status /tmp/worbi-package-staging/worbi/bin/
chmod +x /tmp/worbi-package-staging/worbi/bin/*
```

### Step 7: Build archive
```bash
cd /tmp/worbi-package-staging
tar -czf ~/worbi/packages/worbi-${VERSION}.tar.gz worbi/
```

### Step 8: Verify archive
```bash
ls -lh ~/worbi/packages/worbi-${VERSION}.tar.gz
tar -tzf ~/worbi/packages/worbi-${VERSION}.tar.gz | head -3
tar -tzf ~/worbi/packages/worbi-${VERSION}.tar.gz | grep -q "node_modules" && echo "BAD" || echo "GOOD - no node_modules"
tar -tzf ~/worbi/packages/worbi-${VERSION}.tar.gz | grep -q "worbi/server/dist" && echo "BAD - has server/dist" || echo "GOOD - no server/dist"
```

### Step 9: Update nymph.json
Update `~/worbi/nymph.json`: `version` field and `source.archive` filename.

### Step 10: Commit and push
```bash
cd ~/worbi
git add packages/worbi-${VERSION}.tar.gz nymph.json
git commit -m "Release WORBI ${VERSION}"
# Requires PAT for nymphnerds org — see worbi-github skill
git push "https://x-access-token:TOKEN@github.com/nymphnerds/worbi.git" main
cd ~/Nymphs-Brain/WORBI
git add package.json
git commit -m "Bump version to ${VERSION}"
git push origin master
```
**STOP** — await user authorization before pushing.

### Step 11: Clean up
```bash
rm -rf /tmp/worbi-package-staging
```

---

## 3. Critical Caveats

### CAVEAT 1: `tar --exclude` patterns are unreliable
- Use `rsync -a --exclude='node_modules'` to stage files, then tar the staging directory.

### CAVEAT 2: `rsync` requires parent directories to exist
- `mkdir -p /tmp/worbi-package-staging/worbi/{dist,server,bin}`

### CAVEAT 3: User data must be manually removed from staging
- `server/src/data/users/` and `server/src/data/users.json` must be deleted after rsync.

### CAVEAT 4: Archive MUST have `worbi/` prefix
- Stage into `/tmp/worbi-package-staging/worbi/` then tar.

### CAVEAT 5: Expected archive size ~1.2M (as of v6.2.60)
- If larger than ~2M, something was not properly excluded.

### CAVEAT 6: Terminal output unreliable during packaging
- Always verify with separate follow-up commands after each step.

### CAVEAT 7: Production server, not dev server
- Archive contains pre-built `dist/` static files. Single port 8082.

### CAVEAT 8: Two sets of scripts
- **Bin scripts** (inside archive): `worbi/bin/` — run on target machine
- **Manager scripts** (in module repo): `~/worbi/scripts/` — run by NymphsCore Manager

### CAVEAT 9: Authorization before git push
- Always stop and present what will be pushed.

### CAVEAT 10: Server dist path requires symlink (DISCOVERED v6.2.51)
- `server/src/index.js` resolves frontend at `path.resolve(__dirname, '../dist')` = `server/dist/`
- Installer places dist at `~/worbi/dist/`, so symlink `server/dist -> dist` is required.
- `worbi-start` (v6.2.52+) auto-creates symlink if missing.

### CAVEAT 11: Bin scripts must cd into server/ directory
- `worbi-start` must `cd "$INSTALL_DIR/server"` before `node src/index.js`.

### CAVEAT 12: Rebuild dist/ after frontend code changes before packaging
- Always run `npm run build` AFTER applying frontend fixes.

### CAVEAT 13: Old installs may have real server/dist/ directory
- Check: `test -L ~/worbi/server/dist && echo "OK" || echo "FIX NEEDED"`

### CAVEAT 14: NEVER `mv ~/worbi` during package testing
- The installer's user data preservation logic requires `~/worbi` to exist. Use `bash ~/worbi/scripts/install_worbi.sh` directly instead.

### CAVEAT 15: Verify bundle hash after every deploy
- Compare served hash to built hash — mismatch means stale assets.

### CAVEAT 16: Archive must exclude server/dist/
- After rsync: `rm -rf /tmp/worbi-package-staging/worbi/server/dist`

### CAVEAT 17: Install directory is configurable via env var
- All scripts support `WORBI_INSTALL_DIR` env var to override the default `~/worbi` install path.
- On this dev machine, use `WORBI_INSTALL_DIR=~/worbi-prod` to simulate installs without conflicting with the `~/worbi` git repo.
- Example: `WORBI_INSTALL_DIR=~/worbi-prod bash ~/worbi/scripts/install_worbi.sh`
- Example: `WORBI_INSTALL_DIR=~/worbi-prod worbi-start`
- On a real user's machine, no env var is needed — it defaults to `~/worbi`.

### CAVEAT 18: GitHub PAT for nymphnerds/worbi is in MCP memory
- The PAT token for pushing to `nymphnerds/worbi` is stored in MCP memory under the label "GitHub PAT for nymphnerds/worbi".
- Retrieve with: `memory` → `search_nodes` or `open_nodes` for "GitHub PAT for nymphnerds/worbi".
- Push command: `git push "https://x-access-token:TOKEN@github.com/nymphnerds/worbi.git" main`

---

## 4. Installer Flow (`installer_from_package.sh`)

The installer performs these steps:

1. Extract archive to temp directory
2. Stop existing server if running (`worbi-stop`)
3. Back up existing `~/worbi` user data
4. Remove old `dist/`, `server/`, `bin/` from `~/worbi`
5. Copy new `dist/` (frontend) from archive to `~/worbi/dist/`
6. Copy new `server/` from archive to `~/worbi/server/`
7. Copy new `bin/` from archive to `~/worbi/bin/`
8. **Create symlink:** `ln -sf ~/worbi/dist ~/worbi/server/dist`
9. Restore user data from latest backup:
   - `users.json` → `server/src/data/`
   - `user-settings/` → `server/src/data/`
   - `users/` → `server/src/data/`
10. Create data directories if missing
11. Run `npm install` in `server/`
12. Copy bin scripts to `~/.local/bin/`
13. Write version marker to `~/.nymph-module-version`

---

## 5. Quick Reference — One-Shot Build

```bash
VERSION=$(node -p "require('/home/rauty/Nymphs-Brain/WORBI/package.json').version")
rm -rf /tmp/worbi-package-staging
mkdir -p /tmp/worbi-package-staging/worbi/{dist,server,bin}
cd /home/rauty/Nymphs-Brain/WORBI/client && npm run build
rsync -a dist/ /tmp/worbi-package-staging/worbi/dist/
cd /home/rauty/Nymphs-Brain/WORBI
rsync -a --exclude='node_modules' --exclude='tests' --exclude='test' server/ /tmp/worbi-package-staging/worbi/server/
cp server/package.json /tmp/worbi-package-staging/worbi/
# Remove user data
rm -rf /tmp/worbi-package-staging/worbi/server/src/data/users
rm -f /tmp/worbi-package-staging/worbi/server/src/data/users.json
# Remove server/dist (CRITICAL - must be symlink not bundled dir)
rm -rf /tmp/worbi-package-staging/worbi/server/dist
# Copy bin scripts
cp /home/rauty/Nymphs-Brain/bin/worbi-{start,stop,status} /tmp/worbi-package-staging/worbi/bin/
chmod +x /tmp/worbi-package-staging/worbi/bin/*
# Build archive
cd /tmp/worbi-package-staging && tar -czf ~/worbi/packages/worbi-${VERSION}.tar.gz worbi/
rm -rf /tmp/worbi-package-staging
```

---

## 6. Testing the Package Locally

**DO NOT use `mv ~/worbi-prod ~/worbi-prod-backup`** — it destroys user data. Instead:

```bash
# On a real user's machine:
# 1. Stop current server
worbi-stop
# 2. Run installer
bash ~/worbi/scripts/install_worbi.sh
# 3. Verify symlink
test -L ~/worbi/server/dist && echo "SYMLINK OK" || echo "SYMLINK MISSING"
# 4. Start server
worbi-start
# 5. Verify health
curl -sf http://localhost:8082/api/health
# 6. Verify bundle hash
SERVED=$(curl -sf http://localhost:8082/ | grep -o 'index-[A-Za-z0-9]\+\.js' | head -1)
BUILT=$(grep -o 'index-[A-Za-z0-9]\+\.js' ~/worbi/dist/index.html | head -1)
[[ "$SERVED" == "$BUILT" ]] && echo "BUNDLE MATCH OK" || echo "BUNDLE MISMATCH"
# 7. Check version
cat ~/worbi/.nymph-module-version

# On this dev machine (simulate to ~/worbi-prod):
# WORBI_INSTALL_DIR=~/worbi-prod worbi-stop
# WORBI_INSTALL_DIR=~/worbi-prod bash ~/worbi/scripts/install_worbi.sh
# WORBI_INSTALL_DIR=~/worbi-prod worbi-start
# BUILT=$(grep -o 'index-[A-Za-z0-9]\+\.js' ~/worbi-prod/dist/index.html | head -1)
# cat ~/worbi-prod/.nymph-module-version
```

---

## 7. Registry

The registry repo (`~/rautys-registry/`) contains `rautys.json` which points to the module manifest. URL: `https://raw.githubusercontent.com/rautynerds/rautys-registry/main/rautys.json`

---

## 8. Path Migration Note (v6.3.4)

As of v6.3.4, the following path changes were made:
- **Module repo:** `~/worbi-installer/` → `~/worbi/`
- **Manifest file:** `rauty.json` → `nymph.json`
- **GitHub repo:** `github.com/rautynerds/worbi` → `github.com/nymphnerds/worbi`
- **Install root:** `~/worbi` (default for real users). Scripts support `WORBI_INSTALL_DIR` env override for local simulation.

---

## 9. Legacy Notes (Old Process — Deprecated)

The old process used TypeScript source in archive, two ports (5173 + 8082), and `npm run dev`. Replaced by GitHub module registry approach with production builds, single port, and pre-built static files.