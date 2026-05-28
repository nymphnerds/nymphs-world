---
name: worbi-rules
description: Use when changing the WORBI-derived Nymphs World UI, data flow, backend auth/storage, themes, component patterns, animations, typography, workflow, or when checking WORBI-specific antipatterns. Read the relevant rule file before editing.
---

# WORBI Rules

This skill wraps the complete WORBI rule bundle from `rules.zip`.

Use these rules before touching WORBI-derived app code in Nymphs World:

- `references/rules/01-frontend-architecture.md`
- `references/rules/02-data-flow.md`
- `references/rules/03-backend-auth.md`
- `references/rules/04-ui-colors-themes.md`
- `references/rules/05-ui-components-patterns.md`
- `references/rules/06-ui-animations-states.md`
- `references/rules/07-ui-typography-icons-spacing.md`
- `references/rules/08-workflow-procedures.md`
- `references/rules/09-critical-antipatterns.md`

## Working Rule

Read only the files relevant to the change. For example:

- UI structure or panels: read `01`, `05`, `07`, and `09`.
- Hook or state flow: read `02` and `09`.
- Auth, storage, routes, or services: read `03` and `09`.
- Theme, color, spacing, animation, or visual polish: read `04`, `05`, `06`, `07`, and `09`.
- Test/build/package workflow: read `08` and `09`.

## Conflict Policy

These rules are guidance for the WORBI-derived application. They do not replace:

- current Nymphs World source
- `/home/nymph/NymphsCore/docs/NYMPHS_MODULE_MAKING_GUIDE.md`
- `/home/nymph/NymphsCore/docs/Ideas/NYMPHS_WORLD_WORBI_BASE_LIVING_PLAN.md`
- current module manifests and scripts
- direct user instructions

If a rule conflicts with current source or NymphsCore module standards, stop and verify against source. Do not invent APIs or assume an older WORBI rule is still true.

## Always Remember

- Do not push without explicit user instruction.
- Read files before editing them.
- Do not add dependencies without updating the relevant package manifest.
- Use `lucide-react` for icons in this app.
- Keep the Nymphs World UI WORBI-derived unless the plan explicitly says otherwise.
