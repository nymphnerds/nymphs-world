# Nymphs World

Nymphs World is the page-first worldbuilding vault module for NymphsCore.

This first slice is intentionally small and module-standard compliant:

- `nymph.json` declares install/status/start/stop/open/logs/uninstall actions.
- The installed marker is `$HOME/Nymphs-World/.nymph-module-version`.
- Project data lives under `$HOME/NymphsData/nymphs-world/projects`.
- Logs live under `$HOME/NymphsData/logs/nymphs-world`.
- The Manager UI is a module-owned local URL at `http://127.0.0.1:8098`.
- The app stores readable Markdown pages, JSON project metadata, and rebuildable indexes.

The first vault workflow supports creating a demo world, creating pages,
editing Markdown, resolving `[[wikilinks]]`, building backlinks, scanning media,
and reporting simple diagnostics.

## Module Standard

This module follows the NymphsCore module guide:

```text
NymphsCore/docs/NYMPHS_MODULE_MAKING_GUIDE.md
```

Do not add Manager-specific custom code for Nymphs World. Module UI, lifecycle
scripts, app data, logs, and actions belong in this module.
