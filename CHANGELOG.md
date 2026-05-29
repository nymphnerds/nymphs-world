# Nymphs World Changelog

User-facing and module-level changes for the `nymphs-world` module.

Newest entries first.

## 0.2.9 - 2026-05-29 Restore Generated Codex SDK Browser Login Shape

Changed:

- Restored the generated Codex app-server SDK browser login shape used by the
  last working path: `{ "type": "chatgpt", "codexStreamlinedLogin": true }`.
- Restored the WSL/Windows browser launcher order to open OAuth URLs through
  `explorer.exe` first, with PowerShell only as a fallback.
- Kept `cmd.exe start` out of the OAuth path.

Verified:

- Client typecheck passed.
- Client production build passed.
- Server Codex route/service syntax checks passed.
- Focused Codex/LLM server tests passed: 31 tests.

## 0.2.8 - 2026-05-29 Restore Known-Good Codex Browser Open

Changed:

- Restored the direct Codex app-server browser sign-in handoff used by the
  known-good flow: Nymphs World opens the returned `authUrl` through
  PowerShell `Start-Process -FilePath $args[0]`.
- Removed the experimental local redirect route added in `0.2.7`.
- Kept the official app-server login request as `{ "type": "chatgpt" }`.
- Reverted the WORBI left explorer persisted-width key back to the existing
  `left-width-v2` key so the sidebar uses the prior resizable/default behavior
  instead of a new oversized saved value.

Verified:

- Logged this dev WSL out of Codex and started the Nymphs World browser login
  path; the module generated an `auth.openai.com/oauth/authorize` URL with the
  required OAuth query fields present and opened it through PowerShell. The
  attempt was cancelled after no browser callback returned in this environment.
- Client typecheck passed.
- Client production build passed.
- Server Codex route/service/index syntax checks passed.
- Focused Codex/LLM server tests passed: 31 tests.

## 0.2.7 - 2026-05-29 WSL Codex Browser Handoff Repair

Changed:

- Kept the official Codex app-server browser flow: Nymphs World starts
  `account/login/start` with `{ "type": "chatgpt" }` and waits for
  `account/login/completed`.
- Changed only the WSL/browser handoff path: the app now opens a short local
  Nymphs World redirect URL, which redirects the browser to the official
  Codex `authUrl`. This avoids Windows/WSL process argument handling mangling
  the long OAuth query string before it reaches OpenAI.

Verified:

- Dev WSL Codex status check completed without browser because ChatGPT login is
  already active.
- Raw Codex app-server browser login generated an `auth.openai.com` URL with
  required OAuth fields present.
- Nymphs World local redirect route returned `302` to the Codex/OpenAI auth
  host.
- Client typecheck passed.
- Client production build passed.
- Server Codex route/service/index syntax checks passed.
- Focused Codex/LLM server tests passed: 31 tests.

## 0.2.6 - 2026-05-29 Codex Sign-In Contract Repair

Changed:

- Changed Codex browser sign-in to use the documented app-server request shape:
  `{ "type": "chatgpt" }`.
- Removed the extra streamlined-login flag from Nymphs World's app-server login
  request while keeping device-code sign-in as a separate fallback path.
- Reset the WORBI left explorer width onto another fresh persisted key so test
  WSL installs are not stuck with the oversized sidebar value from the bad UI
  build.

Verified:

- Client typecheck passed.
- Client production build passed.
- Server Codex route/service syntax checks passed.
- Focused Codex/LLM server tests passed: 31 tests.

## 0.2.5 - 2026-05-29 Test WSL Codex and Layout Repair

Changed:

- Reset the WORBI left explorer width onto a fresh persisted key so bad
  `0.2.4` localStorage width values do not carry into the test WSL install.
- Kept the explorer resizable with the WORBI width bounds.
- Changed WSL/Windows Codex sign-in opening to use `explorer.exe` first and
  removed the `cmd.exe start` OAuth fallback entirely.
- Marked browser Codex login requests with the app-server streamlined login
  flag from the generated Codex SDK shape.
- If Codex is already logged in and the app-server account probe succeeds,
  `Sign In` now resolves as already completed instead of opening a fresh,
  failure-prone OAuth page.
- Made the saved Codex provider win even when the settings form has not
  hydrated yet, so API sampling controls do not flash/stick on the Codex path.

Verified:

- Client typecheck passed.
- Server Codex route/service syntax checks passed.
- Focused Codex/LLM server tests passed: 31 tests.

## 0.2.4 - 2026-05-29 Codex Sign-In Regression Repair

Changed:

- Fixed the WSL/Windows browser launcher for Codex sign-in by opening OAuth
  URLs through PowerShell first, so query parameters are not truncated by
  `cmd.exe start`.
- Kept Codex in the LLM provider section and made saved Codex settings hydrate
  the UI immediately, without needing to reselect `Codex Sign In`.
- Kept API-only sampling controls hidden when Codex is selected.
- Made Codex reasoning power update from local form state immediately.
- Restored the WORBI sidebar width as a one-time repair for oversized saved
  settings while preserving normal resizing afterward.

Verified:

- Client typecheck passed.
- Client production build passed.
- Server Codex route/service syntax checks passed.
- Focused Codex/LLM server tests passed: 30 tests.

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
