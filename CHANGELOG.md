# Nymphs World Changelog

User-facing and module-level changes for the `nymphs-world` module.

Newest entries first.

## 2026-05-28 Codex Sign-In Provider Lane

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
- Added focused Codex unit tests and a Nymphs World WORBI handoff document.
- Added project-local WORBI rule skills under `.agents/skills/worbi-rules`.

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

## 2026-05-28 WORBI Workspace Base

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
