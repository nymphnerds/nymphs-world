---
name: nymphs-safety
description: Critical safety rules for Nymphs projects - dependencies, WSL/Windows mixed environment, command chaining, and git operations
---

# Nymphs Safety — Generic Safety Rules Skill

Use this skill when working on **any Nymphs project** (WORBI, Z-Image, TRELLIS.2, etc.).

---

## 1. Dependencies

- Never introduce a new dependency without updating the appropriate `package.json` (root, server, or client)
- Projects use `npm workspaces` — add deps to the correct workspace
- Avoid installing packages globally unless system tooling requires it

---

## 2. Mixed Environment (WSL/Windows)

- Backends (Express, FastAPI, Python services) run inside a WSL container
- Frontends (React/Vite) run as Windows applications
- Never assume both layers run on the same OS
- When executing commands, use `wsl` prefix for backend operations if needed
- Verify paths are WSL-accessible (not Windows paths) for any server-side code

---

## 3. Terminal Command Chaining

- Never use `&&` to chain multiple commands in a single terminal command — this causes the Cline agent to crash
- Instead, execute each command separately as individual `execute_command` calls
- If multiple steps are needed (e.g., `cd` then `npm run`), run them one at a time

---

## 4. Git Operations (GitHub Push/Commit)

- **NEVER push to GitHub** without explicit user instruction to do so
- **NEVER commit and push** as part of finalizing a feature — only commit if the user explicitly asks for it
- Updating CHANGELOG.md and update_record.md is fine, but `git push` is strictly forbidden unless the user says "push to github" or similar
- Do NOT assume a push is wanted just because changes are complete
- If a git commit was made without permission, inform the user before pushing

---

## Cross-Project Notes

- **Changelog format:** See project-specific conventions (e.g., `worbi-conventions` §5)
- **Icon library:** See project-specific UI skills (e.g., `worbi-ui` §11)
- **Dark theme:** All Nymphs projects are dark-theme only — see project-specific UI skills
- **Component states:** See project-specific UI skills for state coverage requirements
- **Short changes:** For ≤5 line changes, see `small-change-delegation` skill