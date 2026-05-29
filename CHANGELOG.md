# Nymphs World Changelog

User-facing and module-level changes for the `nymphs-world` module.

Newest entries first.

## 0.2.3 - 2026-05-29 Codex LLM Layout Repair

Changed:

- Restored the WORBI left settings panel to the normal resizable sidebar width.
- Kept Codex inside the LLM provider section instead of a separate top-level
  settings tab.
- Hid API-key and sampling controls when `Codex Sign In` is selected.
- Kept Codex to one primary `Sign In` action plus `Check`, model, reasoning
  power, and system prompt controls.

Verified:

- Client typecheck passed.
- Client production build passed.
- Focused Codex/LLM server tests passed: 29 tests.
- Installed runtime updated to `0.2.3` and verified at
  `http://127.0.0.1:8083`.

## 0.2.2 - 2026-05-29 Codex Settings Cleanup

Changed:

- Moved Codex controls into a dedicated Settings tab.
- Reduced Codex sign-in to one primary `Sign In` action plus `Check`.
- Removed API-only inference controls from the Codex path.
- Added Codex reasoning power selection and routes the selected effort into
  Codex creative turns.
- Widened the Settings panel when opened from the WORBI activity bar.
- Switched WSL sign-in opening to the Windows default browser path with
  fallbacks.

Verified:

- Client production build passed.
- Server syntax checks passed for Codex service/config.
- Installed runtime was updated and verified at `http://127.0.0.1:8083`.

## 0.2.1 - 2026-05-28 Codex Sign-In Provider Lane

Added:

- Added `Codex Sign In` as a distinct LLM provider lane for subscription-backed
  creative writing and worldbuilding actions.
- Added backend `/api/codex` status, probe, login, login-open, and login-cancel
  routes.
- Added a Codex app-server adapter that can read account/model state, list
  available Codex models, and run guarded creative text turns.
- Added browser sign-in and device-code sign-in flows in Settings.
- Added OS/default-browser opening for Codex auth URLs so Manager/WebView does
  not create tabless popup browser windows.
- Added Codex status keys to the module status flow, including CLI, login,
  app-server, and ready state.
- Added focused Codex unit tests, a Nymphs World WORBI handoff document, and a
  tomorrow handoff for continuing the work.
- Added project-local WORBI rule skills under `.agents/skills/worbi-rules`.
- Added Nymphs World planning docs under `docs/Ideas/`.

Changed:

- Settings now separates Local/Brain, API-key providers, and Codex subscription
  sign-in instead of treating all LLM paths as OpenAI-compatible URLs.
- Codex-backed chat, completion, and document generation are routed through a
  read-only, no-network creative adapter instead of through API-key provider
  settings.
- Codex sign-in UI was tightened for the narrow WORBI settings panel, with
  compact status rows, one-column actions, pending open/copy fallbacks, and
  explicit device-code support.
- Module install/update/status scripts now treat Codex as an optional provider
  dependency rather than a core runtime blocker.
- Module version is now `0.2.1` so Manager can detect the remote update from an
  installed `0.2.0` package.

Verified:

- Server syntax checks passed for the Codex service and route.
- Server unit tests passed: `29 passed`.
- Client production build passed.
- Installed runtime was updated and verified running at `http://127.0.0.1:8083`
  with `codex_ready=true`.
- Live Codex device-code start/cancel smoke test returned a login id,
  verification URL, user code, and cancelled cleanly.

Notes:

- Codex is optional. Nymphs World should still install, start, and open without
  Codex, OpenRouter, or local Brain being configured.
- Codex file tools, image transcription, media generation, and streaming UI are
  intentionally separate future proof passes.

## 0.2.0 - 2026-05-28 WORBI Workspace Base

Added:

- Adopted the current WORBI workspace as the Nymphs World UI base.
- Added NymphsCore module wrapper scripts for install, update, start, stop,
  status, logs, open, open-worlds, smoke test, and uninstall behavior.
- Added project/data roots under `$HOME/NymphsData/nymphs-world`.

Changed:

- Nymphs World now runs as a WORBI-derived workspace module rather than the old
  prototype UI.
- Production/backend port is `8083`; Vite dev frontend port is `5174`.
- Module status exposes install/runtime/data roots and health URLs for Manager.

Notes:

- WORBI remains the UI foundation. Old prototype screens are reference material,
  not the active product surface.
