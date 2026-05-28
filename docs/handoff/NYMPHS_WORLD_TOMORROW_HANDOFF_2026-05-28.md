# Nymphs World Tomorrow Handoff

Date: 2026-05-28
Repo: `nymphnerds/nymphs-world`
Branch: `main`

## Current State

Nymphs World is now a WORBI-derived NymphsCore module. The source and
installable module payload live in the remote repo:

```text
https://github.com/nymphnerds/nymphs-world.git
```

Manager install/update should use the normal remote path:

```text
registry -> remote nymph.json -> remote nymphs-world repo -> local install at ~/Nymphs-World
```

Do not treat `/home/nymph/NymphsModules/nymphs-world` as the Manager source of
truth. It is the local development checkout. The installed package that Manager
runs is:

```text
/home/nymph/Nymphs-World
```

The local installed marker before the version bump was:

```text
/home/nymph/Nymphs-World/.nymph-module-version = 0.2.0
```

The remote manifest has been bumped to `0.2.1` so Manager can show an update.

## What Shipped Today

- Adopted the current WORBI UI as the Nymphs World base.
- Added module wrapper scripts for install, update, start, stop, status, logs,
  open, open-worlds, smoke test, and uninstall.
- Added the Codex Sign In provider lane.
- Added backend `/api/codex` routes.
- Added Codex app-server status, account/model probe, browser login,
  device-code login, login-open, login-cancel, and guarded creative text turns.
- Routed Codex-backed chat, inline completion, and document generation through
  a read-only, no-network creative adapter.
- Tightened the Codex settings UI for the narrow WORBI settings panel.
- Fixed browser sign-in so auth opens through the OS/default browser instead of
  WebView `window.open` tabless popup windows.
- Added `CHANGELOG.md`.
- Updated install/update scripts so `CHANGELOG.md` is copied into the installed
  module package.
- Copied planning docs into this repo under `docs/Ideas/`.

## Verified

- Server syntax checks passed:
  - `app/server/src/services/codexService.js`
  - `app/server/src/routes/codex.js`
- Server focused tests passed:
  - `tests/unit/services/codexService.test.ts`
  - `tests/unit/services/llmService.test.ts`
  - result: `29 passed`
- Client production build passed.
- Installed runtime was started successfully at:
  `http://127.0.0.1:8083`
- Runtime status reported:
  - `running=true`
  - `codex_cli=true`
  - `codex_logged_in=true`
  - `codex_app_server=true`
  - `codex_ready=true`
- Live Codex device-code start/cancel smoke returned:
  - type `chatgptDeviceCode`
  - login id present
  - verification URL present
  - user code present
  - cancelled cleanly

## Pushed Commits

Latest pushed before the `0.2.1` docs/version handoff commit:

```text
f2a3ae8 Copy changelog into installed package
d3b0973 Add Nymphs World changelog
a92d928 Add Codex sign-in provider lane
8da34ac feat: adopt WORBI workspace base
```

The `0.2.1` docs/version handoff commit should include:

- `nymph.json` version bump to `0.2.1`
- changelog heading updates
- copied plan docs in `docs/Ideas/`
- this tomorrow handoff

## Important Context

Manager did not show an update because both local installed marker and remote
manifest were `0.2.0`. The fix is the remote `nymph.json` version bump to
`0.2.1`. Do not run a local update before checking Manager update visibility,
or the marker will also become `0.2.1` and the update signal will disappear.

Normal Manager update detection:

```text
remote manifest version > installed .nymph-module-version
```

Normal install/update source:

```text
https://github.com/nymphnerds/nymphs-world.git
```

Normal installed runtime:

```text
/home/nymph/Nymphs-World
```

## Do Next

1. Push the pending `0.2.1` docs/version commit if it has not already been
   pushed.
2. In Manager, refresh/check updates for Nymphs World.
3. Confirm it shows update available from `0.2.0` to `0.2.1`.
4. Run Manager update/repair from the remote path.
5. Confirm `/home/nymph/Nymphs-World/CHANGELOG.md` exists after update.
6. Reopen Nymphs World and retest Settings -> LLM -> Codex Sign In.
7. If UI width still feels cramped, adjust the Settings container/layout next,
   not just the Codex card.

## Next Product Planning Thread

After the remote update path is clean, return to media generation layout
planning:

- keep WORBI explorer/editor/right-panel as the base
- design media generation around `Assets/`, `Production/briefs`, and
  `Production/jobs`
- plan map generator and biome maker as specialist workspace actions
- keep prompts careful and page/context-aware
- preserve Local/Brain, OpenRouter/API, and Codex provider lanes as separate
  concepts

## Guardrails

- Do not push to the WORBI remote.
- Only push to `nymphnerds/nymphs-world` when changing this module repo.
- Keep NymphsCore docs commits separate from module repo commits.
- Do not ask users to paste ChatGPT cookies, browser sessions, or private
  tokens.
- Keep Codex optional; Nymphs World must still install/start/open without Codex.
