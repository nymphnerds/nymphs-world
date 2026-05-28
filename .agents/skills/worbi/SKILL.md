---
name: worbi
description: WORBI skills index - master skill file linking to all WORBI-specific skills (project, API, architecture, conventions, UI) with toggle guide
---

# WORBI Skills Index

Master index for all WORBI-specific skills. Toggle on individual skills as needed.

---

## WORBI Skills

| Skill | File | Toggle On When... |
|-------|------|-------------------|
| **Project Identity** | `worbi-project` | Need directory map, tech stack, feature list, version info, or handoff doc index |
| **API Reference** | `worbi-api` | Working on backend routes, API endpoints, auth flow, or client API types |
| **Architecture** | `worbi-architecture` | Refactoring, understanding data flow, component tree, or backend service patterns |
| **App.tsx Refactor** | `worbi-app-refactor` | Modifying App.tsx, extracting features, or adding new feature modules |
| **Conventions** | `worbi-conventions` | Adding new features, writing code, or need naming/import/CSS/changelog patterns |
| **UI Design System** | `worbi-ui` | Building/styling UI components — colors, typography, CSS classes, animations, states |
| **GitHub** | `worbi-github` | Working with git, pushing, or need remote/repository details |
| **Packaging** | `worbi-package` | Building a distributable WORBI package (tar.gz + install.sh) |
| **Tests** | `worbi-tests` | Writing, running, or debugging tests — Vitest setup, patterns, helpers |

---

## Generic Skills (Always Available)

| Skill | Toggle On When... |
|-------|-------------------|
| **cline-thinking** | Need explicit reasoning guardrails and execution discipline |
| **nymphs-dark-ui** | DEPRECATED — use `worbi-ui` for WORBI. Keep for non-WORBI Nymphs projects only |
| **nymphs-safety** | Safety check needed (dependencies, changelog, icons, WSL) |
| **small-change-delegation** | Code change affects 5 or fewer lines in a single file |

---

## Recommended Load Order

1. **Always load first:** `worbi-project` (context) + `worbi-conventions` (rules)
2. **Then load as needed:**
   - Backend work → `worbi-api` + `worbi-architecture`
   - Frontend work → `worbi-architecture` + `worbi-ui`
   - App.tsx changes → `worbi-app-refactor` + `worbi-architecture`
   - New UI components → `worbi-ui` + `worbi-conventions`
    - New features → `worbi-conventions` + `worbi-architecture`
    - Git operations → `worbi-github`
    - Tests → `worbi-tests`
    - Packaging → `worbi-package`

---

*Skill version: 2.1 — matches WORBI v6.2.40*