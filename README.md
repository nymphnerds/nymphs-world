# Nymphs World

Nymphs World is the WORBI-derived worldbuilding workspace module for NymphsCore.

This development slice replaces the old prototype UI with the current WORBI app base:

- `nymph.json` declares install/status/start/stop/open/logs/uninstall actions.
- The installed marker is `$HOME/Nymphs-World/.nymph-module-version`.
- Module data lives under `$HOME/NymphsData/nymphs-world`.
- Logs live under `$HOME/NymphsData/logs/nymphs-world`.
- The Manager UI is a module-owned local URL at `http://127.0.0.1:8083`.
- The app starts from WORBI's React/Express workspace, explorer, editor, tabs,
  AI/chat surfaces, image panel, templates, and deterministic export direction.
- Worlds live under `$HOME/NymphsData/nymphs-world/projects/<world-id>`.
- New/active worlds use the Nymphs World vault structure: `MainStory`,
  `Quests`, `PlayerCharacters`, `NPCs`, `Locations`, `Factions`, `Items`,
  `Scenes`, `Lore`, `Maps`, `Biomes`, `Assets`, `Production`, `_system`, and
  `.nymphs-world`.
- The image panel bridges to the local Nymphs Image/Z-Image module at
  `http://127.0.0.1:8090` and stores generated image assets under the active
  project at `Assets/generated/images`.
- Codex Sign In is an optional provider lane for ChatGPT subscription-backed
  story, lore, character, quest, and specialist drafting. It uses the official
  standalone Codex CLI/app-server path and does not replace Local/Brain or
  OpenRouter/API providers.

The current storage slice keeps WORBI's explorer/editor API shape, but resolves
the old workspace root to the active Nymphs World project vault.

## Module Standard

This module follows the NymphsCore module guide:

```text
NymphsCore/docs/NYMPHS_MODULE_MAKING_GUIDE.md
```

Do not add Manager-specific custom code for Nymphs World. Module UI, lifecycle
scripts, app data, logs, and actions belong in this module.

## Optional Codex Dependency

Codex Sign In needs the standalone Codex CLI:

```text
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

The module status script reports `codex_cli`, `codex_logged_in`,
`codex_app_server`, and `codex_ready`. Missing Codex support must not block the
module from installing or running because Local/Brain and OpenRouter/API remain
valid provider paths.
