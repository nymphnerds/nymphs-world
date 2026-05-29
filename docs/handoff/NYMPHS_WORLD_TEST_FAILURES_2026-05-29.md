# Nymphs World Test Failure Notes - 2026-05-29

This note records unrelated failures seen while verifying the Codex settings
work. The focused Codex and LLM checks passed; the items below need their own
cleanup pass.

## Codex Sign-In Regression Caught Later

After `0.2.3`, browser sign-in could open an OpenAI auth error page with:

```text
Authentication Error
error_code: missing_required_parameter
```

Likely cause:

- The WSL browser opener tried `cmd.exe /c start` first.
- OAuth URLs contain `&` query parameters, and `cmd.exe start` can treat those
  as command separators unless the URL is protected.
- Result: OpenAI received a truncated authorization URL.

Repair in `0.2.4`:

- WSL/Windows browser opening now tries PowerShell `Start-Process` first.
- The `cmd.exe` fallback quotes the URL.
- A focused unit test now verifies that WSL OAuth URLs are passed through
  PowerShell intact.

Follow-up repair in `0.2.5`:

- Testing was happening in a separate test WSL, not this development WSL.
- Local probing in the development WSL showed the Codex app-server returned an
  auth URL with the required OAuth fields (`client_id`, `redirect_uri`,
  `response_type`, `state`, `code_challenge`, and `scope`).
- The module now opens WSL/Windows OAuth URLs through `explorer.exe` first and
  removes the `cmd.exe start` fallback entirely.
- Browser login requests now include the app-server `codexStreamlinedLogin`
  flag from the generated Codex SDK shape.
- If Codex is already logged in and `account/read` succeeds, the sign-in action
  now returns completed instead of opening another OAuth page.

Follow-up repair in `0.2.6`:

- The public `openai/codex` app-server documentation describes browser
  ChatGPT managed auth as `account/login/start` with exactly
  `{ "type": "chatgpt" }`, then opening the returned `authUrl`.
- Nymphs World removed the extra `codexStreamlinedLogin` flag from browser
  sign-in requests and keeps device code as the separate fallback path.
- The WORBI left explorer width was moved to another fresh persisted key
  (`left-width-v3`) so test WSL installs drop the oversized width from the bad
  build while preserving resizing.

Follow-up repair in `0.2.7`:

- The official Codex app-server auth sequence is still unchanged:
  `account/login/start` with `{ "type": "chatgpt" }`, then open the returned
  `authUrl`, then wait for `account/login/completed`.
- To protect that official `authUrl` from WSL/Windows process argument
  mangling, the external browser now opens a short local Nymphs World redirect
  URL. The server responds with `302` to the exact app-server `authUrl`.
- This makes the browser handoff boring: no long OpenAI OAuth query string is
  passed through `explorer.exe` or PowerShell directly.
- Dev WSL checks after the change:
  - Nymphs World completed browser sign-in without opening a browser because
    ChatGPT login is already active in this dev WSL.
  - A raw Codex app-server browser login generated an `auth.openai.com`
    `/oauth/authorize` URL with `client_id`, `redirect_uri`, `response_type`,
    `state`, `code_challenge`, and `scope` present.
  - The Nymphs World public redirect route returned `302` to `auth.openai.com`.

Follow-up repair in `0.2.8`:

- User confirmed the browser sign-in worked before today's browser-handoff
  changes.
- Removed the `0.2.7` local redirect layer and restored direct opening of the
  Codex app-server returned `authUrl` through PowerShell:
  `Start-Process -FilePath $args[0]`.
- Kept the official app-server login request as `{ "type": "chatgpt" }`.
- Reverted the left explorer persisted-width key from `left-width-v3` back to
  the prior WORBI `left-width-v2` key. The v3 reset caused test installs to
  land on the wrong sidebar width behavior.
- Dev WSL logout/sign-in check:
  - `codex logout` succeeded outside the sandbox.
  - Nymphs World `startCodexLogin("browser")` returned a pending login with an
    `auth.openai.com/oauth/authorize` URL containing `client_id`,
    `redirect_uri`, `response_type`, `state`, `code_challenge`, `scope`, and
    related Codex fields.
  - Nymphs World opened the URL through PowerShell default browser.
  - No callback returned in this environment before timeout, so the attempt was
    cancelled. This verified generated URL shape and launcher, not user-side
    browser completion.

Follow-up repair in `0.2.9`:

- Restored the generated Codex app-server SDK browser login shape:
  `{ "type": "chatgpt", "codexStreamlinedLogin": true }`.
- Restored the WSL/Windows browser launcher order from the last working path:
  `explorer.exe` opens the returned `authUrl` first, with PowerShell fallback.
- Kept `cmd.exe start` out of the OAuth launch path.

Follow-up repair in `0.2.10`:

- Checked the official OpenAI Codex app-server docs on 2026-05-29.
- The documented browser ChatGPT flow is `account/login/start` with exactly
  `{ "type": "chatgpt" }`, then opening the returned `authUrl` and waiting for
  `account/login/completed`.
- Removed the undocumented `codexStreamlinedLogin` field restored in `0.2.9`.
- Added a focused unit test that asserts the JSON-RPC login params sent to the
  Codex app-server.

Follow-up repair in `0.2.11`:

- Test WSL still produced OpenAI `missing_required_parameter` pages on `0.2.10`.
- Root cause: the long Codex/OpenAI OAuth URL was still passed directly through
  the Windows/WSL external browser process boundary.
- Browser sign-in now opens a short local Nymphs World URL instead. The server
  responds with `302` to the exact Codex `authUrl`, so OAuth query parameters
  are no longer exposed to Windows launcher argument parsing.
- Added a focused route test for the redirect behavior.

Follow-up repair in `0.2.12`:

- Found a stale Nymphs World Node process that survived the module update and
  kept serving pre-update Codex routes.
- The update script now stops a running Nymphs World server before replacing
  app files, then restarts it after a successful update.
- This keeps Manager's installed version, the files on disk, and the live
  backend process in sync.
- The module-owned `stop` action is labeled `Close UI` so users see the action
  in the module action area without a Manager-owned rail change.

Related UI regression:

- Saved Codex settings did not always hydrate the LLM settings form, so the UI
  could stay on API controls until `Codex Sign In` was reselected.
- `0.2.4` makes saved Codex provider state force the Codex UI immediately and
  keeps API-only sampling controls hidden on that path.
- `0.2.5` makes saved Codex provider state win even before the local form state
  catches up, and moves the WORBI left explorer width to a fresh persisted key
  so a bad saved width from `0.2.4` does not carry forward.
- `0.2.6` keeps the Codex settings inside the LLM provider branch, with API-only
  sampling controls outside that branch.

## Passing Checks

- `app/client`: `npm run test:typecheck`
- `app/client`: `npm run build`
- `app/server`: `node --check src/services/codexService.js`
- `app/server`: `node --check src/routes/codex.js`
- `app/server`: `npm test -- tests/unit/services/codexService.test.ts tests/unit/services/llmService.test.ts`

Focused server result after `0.2.4`: 2 test files, 30 tests passed.
Focused server result after `0.2.5`: 2 test files, 31 tests passed.
Focused server result after `0.2.6`: 2 test files, 31 tests passed.
Focused server result after `0.2.7`: 2 test files, 31 tests passed.
Focused server result after `0.2.8`: 2 test files, 31 tests passed.
Focused server result after `0.2.9`: 2 test files, 31 tests passed.
Focused Codex service result after `0.2.10`: 1 test file, 6 tests passed.
Focused Codex result after `0.2.11`: 2 test files, 7 tests passed.
Update lifecycle script result after `0.2.12`: syntax check passed.

## Root Workspace Vitest Startup Failure

Running the focused tests from `app/` with root `npm test` hit a config startup
failure before tests executed:

```text
Error [ERR_REQUIRE_ESM]: require() of ES Module .../vite/dist/node/index.js
from .../vitest/dist/config.cjs not supported.
```

Running the same focused tests from `app/server` passed. This looks like root
workspace Vitest/Vite config drift, not a Codex sign-in failure.

## Unrelated Unit Failures

`tests/unit/services/llmAgentTools.test.ts` failed in the full server suite.

Observed causes:

- The test mocks are missing current tag/location exports:
  `removeTagFromFile` and `removeLocationFromFile`.
- Some expectations still use the old service signatures. The implementation
  now calls tag/location services with the username first, such as
  `getFilesByTag('testuser', 'MainChar')`.
- `location_list` and `location_create` now require authenticated context, but
  the existing tests still treat them like unauthenticated helper calls.

Follow-up:

- Update the mocked tag/location service surface.
- Update expected calls to include username-aware signatures.
- Decide whether each location tool test should provide authenticated context
  or explicitly assert the auth failure.

## Sandbox-Limited Integration Failures

The broader integration suite hit listener failures in this Codex sandbox:

```text
listen EPERM: operation not permitted 0.0.0.0
```

Affected integration areas included auth, settings, timeline, image generation,
and graph tests through their supertest app startup path.

Follow-up:

- Run these integration tests outside the sandbox or in CI with normal listen
  permissions.
- Consider adding a test mode that binds only where the sandbox allows, or uses
  a no-listen request harness.

## Current Interpretation

These failures do not look related to the Codex provider UI or sign-in changes.
The focused Codex service checks passed, and the remaining failures are either
test-harness drift or sandbox listener restrictions.
