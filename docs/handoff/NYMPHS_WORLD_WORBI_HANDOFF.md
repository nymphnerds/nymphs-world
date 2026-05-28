# Nymphs World WORBI Handoff

Date: 2026-05-28
Repo: `nymphnerds/nymphs-world`
Base: WORBI UI and workflow, adapted as a NymphsCore module.

## Current Direction

Nymphs World uses the current WORBI interface as the base. Do not rebuild the
old prototype UI. Keep the explorer/editor/right-panel workflow and extend it
for Nymphs World project vaults, media generation, graph/context panels, and
production draft assets.

## LLM Provider Lanes

Keep AI access split into clear lanes:

1. Local stack / Brain-first.
   Use Nymphs Brain when installed and healthy. Keep local OpenAI-compatible
   endpoints available for LM Studio, Ollama, llama.cpp, LocalAI-style servers,
   TextGen WebUI where compatible, and other local services.

2. OpenRouter and API providers.
   Keep OpenRouter-style providers as optional API-key lanes. Label them as API
   providers, not ChatGPT subscription use.

3. Codex Sign In.
   This is the intended lane for users who want WORBI/Nymphs World creative LLM
   features powered by their signed-in Codex/ChatGPT subscription. It is for
   story drafting, character bios, faction writing, quest beats, lore expansion,
   editor continuations, map/biome briefs, prompt refinement, page repair,
   summaries, and production draft asset planning.

## Codex Integration Rule

Do not ask users to paste ChatGPT cookies, browser sessions, or private tokens.
Use Codex-managed ChatGPT login/device-code flows through Codex app-server.

The current safe implementation target is:

- backend capability/status endpoints first
- account and rate-limit visibility next
- browser and device-code login start after app-server availability is proven
- creative turn adapter only after status/login/thread/turn behavior is tested

The adapter must preserve WORBI's creative-writing intent. Codex transport must
receive worldbuilding instructions, selected page/project context, and explicit
output shape. It must not default into repository-editing behavior.

## Current Codex Dependency Status

The official standalone Codex CLI is installed in this WSL:

```text
/home/nymph/.local/bin/codex
codex-cli 0.134.0
```

`codex login status` reports ChatGPT login, and
`codex app-server daemon start` was verified outside the sandboxed Codex agent.
The daemon reports version `0.134.0`.

Inside a sandboxed Codex coding session, probing the app-server socket can still
fail with an operation-permitted error because the agent sandbox cannot access
the user's app-server control socket. Treat that as a sandbox limitation, not a
Nymphs World runtime failure. The Manager-launched module should probe Codex
from the normal WSL user environment.

Codex is still an optional dependency. Nymphs World must install, start, and
work with Local/Brain or OpenRouter/API providers when Codex is missing or not
signed in.

## Current Codex Adapter Slice

Implemented in source:

- `/api/codex/status` checks CLI, login, and daemon readiness
- `/api/codex/probe` opens app-server over stdio and reads account/model state
- `fetchModels()` routes the Codex provider to app-server `model/list`
- text chat, inline completion, and structured document generation can route
  through a guarded Codex creative turn path
- Settings can select `Codex Sign In`, probe account/model availability, and
  persist a selected Codex model
- `/api/settings/test` verifies Codex through account/model probe, not just CLI
  presence
- Settings exposes browser sign-in and device-code sign-in. Browser sign-in
  asks the backend to open the returned auth URL through the OS default browser,
  avoiding WebView popup windows. The UI keeps an open/copy fallback visible
  while pending; device-code sign-in shows the user code plus open/copy actions.
  Both paths poll `account/login/completed`.

Current guardrails:

- Codex turns run with `approvalPolicy=never`
- turn sandbox is `readOnly` with `networkAccess=false`
- web search is disabled in Codex config
- prompts explicitly forbid shell commands, file reads/writes, web search, and
  implementation tool behavior
- if a user asks for a file while using Codex, the adapter should draft content
  in the response instead of editing disk

Not wired yet:

- image transcription through Codex vision
- WORBI/Nymphs World file tools through Codex
- streaming UI for partial Codex deltas

## Ports

- WORBI production/backend: `8082`
- WORBI Vite dev frontend: `5173`
- Nymphs World production/backend: `8083`
- Nymphs World Vite dev frontend: `5174`
- Never use `8084`; it is reserved for a colleague-owned remote Git server
  admin surface.
- Prefer `7000+` for future auxiliary services.

## References

- NymphsCore module guide:
  `/home/nymph/NymphsCore/docs/NYMPHS_MODULE_MAKING_GUIDE.md`
- Living plan:
  `/home/nymph/NymphsCore/docs/Ideas/NYMPHS_WORLD_WORBI_BASE_LIVING_PLAN.md`
- Official Codex CLI docs:
  `https://developers.openai.com/codex/cli`
- Official Codex app-server docs:
  `https://developers.openai.com/codex/app-server`
