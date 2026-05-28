---
name: worbi-app-refactor
description: WORBI App.tsx split architecture rules — how to keep App.tsx small, when to extract feature hooks, dependency rules, wiring patterns, and gotchas
---

# WORBI Skill — App.tsx Split Architecture

Use this skill when making changes to **WORBI's App.tsx** or any feature module in `client/src/features/`. These rules ensure App.tsx remains a slim orchestrator and new features are added without bloating the monolith.

---

## 1. Architecture Overview

`App.tsx` is an **orchestrator**, not a monolith. It imports feature hooks, calls them in dependency order, wires callbacks between them, and renders JSX passing destructured values as props.

| Metric | Value |
|--------|-------|
| **Original App.tsx** | ~1,578 lines |
| **Current App.tsx** | ~1,376 lines |
| **Target App.tsx** | ~360 lines (77% reduction) |
| **Lines Saved So Far** | ~200 lines (~13% reduction) |
| **Feature Modules Wired** | `useLayout`, `useActivityRouter`, `useSettings`, `useFileOperations`, `useGraphManager`, `useKeyboardShortcuts`, `useUnsavedWarning`, `useImageConversion`, `AuthProvider`, `AppDialogs` |
| **Feature Modules NOT Wired** | `LayoutContext`, `AppLayout` (exist but unused in App.tsx) |

---

## 2. Directory Structure

```
client/src/
├── App.tsx                           ~1,376 lines — orchestrator + cross-cutting concerns
├── main.tsx                          Wraps <App> with <AuthProvider>
├── features/
│   ├── layout/
│   │   ├── useLayout.ts              Panel widths, drag, AI sidebar, icon visibility (WIRED)
│   │   ├── LayoutContext.tsx         React context (NOT WIRED — available for deep nesting)
│   │   └── AppLayout.tsx             Presentational grid (NOT WIRED — available)
│   ├── auth/
│   │   └── AuthProvider.tsx          Auth context + login gate (WIRED in main.tsx)
│   ├── navigation/
│   │   ├── useActivityRouter.ts      Activity switching + tag sidebar (WIRED)
│   │   └── useSettings.ts            Settings modal toggle (WIRED - imported)
│   ├── files/
│   │   ├── useFileOperations.ts      File CRUD + undo/redo + DOCX (WIRED)
│   │   └── useBatchSelection.ts      Batch multi-select ops (EXISTS)
│   ├── editor/
│   │   ├── useUnsavedWarning.ts      beforeunload + dirty tab warning (WIRED)
│   │   └── useImageConversion.ts     Proxy↔server URL conversion (WIRED)
│   ├── keyboard/
│   │   └── useKeyboardShortcuts.ts   Ctrl+S, Ctrl+Shift+N, F1 (WIRED)
│   └── graph/
│       └── useGraphManager.ts        Graph modal state + callbacks (WIRED)
├── components/
│   └── AppDialogs.tsx                Confirm/Prompt/FolderPicker dialogs (WIRED)
├── hooks/                            Existing hooks (NO changes needed)
│   ├── useAuth.ts                    Used internally by AuthProvider
│   ├── useFiles.ts                   Used internally by useFileOperations
│   ├── useFileSystemUndoRedo.ts      Used internally by useFileOperations
│   ├── useLLM.ts                     Called directly in App.tsx
│   ├── useRecents.ts                 Called directly in App.tsx
│   ├── useSearch.ts                  Called directly in App.tsx
│   ├── useBookmarks.ts               Called directly in App.tsx
│   ├── useLocations.ts               Called directly in App.tsx
│   ├── useReminders.ts               Called directly in App.tsx
│   ├── useImageGeneration.ts         Called directly in App.tsx
│   ├── useSessionPersistence.ts      Called directly in App.tsx
│   ├── useGraph.ts                   Used internally by useGraphManager
│   ├── useTags.ts                    Called directly in App.tsx
│   └── useTheme.ts                   applyThemeColours in App.tsx
├── pages/
│   ├── Login.tsx                     Rendered by AuthProvider
│   └── Settings.tsx                  Rendered by App.tsx
└── services/
    └── api.ts                        NO changes
```

---

## 3. The Orchestrator Pattern

App.tsx follows this 7-step pattern:

1. **Import feature hooks** — One import per feature module
2. **Call hooks in dependency order** — React rules-of-hooks require sequential calls
3. **Destructure return values** — Extract only what's needed
4. **Wire callbacks between hooks** — e.g., `useActivityRouter` needs `toggleLeftPanel` from `useLayout`
5. **Compute derived values** — `dirty`, `canRestore`, `wordCount` from tab state
6. **Render JSX** — Pass destructured values as props to children
7. **No business logic in JSX** — Only conditional rendering and prop passing

```tsx
// Pattern:
export default function App() {
  const { user, isAuthenticated } = useAuthContext();           // Auth first
  const layout = useLayout();                                    // Layout second
  const { ... } = layout;
  const nav = useActivityRouter(toggleLeftPanel, setLeftPanelHidden);  // Depends on layout
  const fileOps = useFileOperations(showFolderPicker);           // Depends on dialog state
  const graph = useGraphManager(user?.username);                 // Depends on auth
  const { ... } = useKeyboardShortcuts({ onSave, ... });        // Depends on wired callbacks

  return <div>...</div>;                                         // JSX shell
}
```

**Key rule:** Features are called in dependency order. A feature that needs something from another feature receives it as a parameter — never import directly.

---

## 4. Dependency Rules

| Module | May Import From | Must NOT Import |
|--------|----------------|-----------------|
| `features/layout/*` | React only | Other features, hooks, services |
| `features/auth/*` | `hooks/useAuth`, `pages/Login`, React | Other features |
| `features/navigation/*` | React only | Other features, hooks |
| `features/files/*` | `hooks/useFiles`, `hooks/useFileSystemUndoRedo`, `services/api` (types), React | Other features |
| `features/editor/*` | `features/files/*` (tab params), React | hooks directly |
| `features/keyboard/*` | React only | Other features, hooks |
| `features/graph/*` | `hooks/useGraph`, `services/api` (types), React | Other features |
| `App.tsx` | ALL features, ALL hooks, ALL components | Nothing (universal importer) |
| Components (`components/*`) | `features/layout/LayoutContext` (optional), `hooks/*`, `services/api`, React | Other features |
| Hooks (`hooks/*`) | `services/api`, React | Features (`features/*`) |
| `services/api.ts` | `fetch` only | Everything else |

**Golden rule:** Features can depend on hooks and services, but NOT on other features. Hooks never depend on features. App.tsx is the ONLY file that imports from all domains.

**Circular dependency prevention:** If Feature A needs something from Feature B, lift it to App.tsx and pass it as a parameter. Example: `useActivityRouter` needs `toggleLeftPanel` from `useLayout` — App.tsx passes it.

---

## 5. What Stays in App.tsx (and Why)

These concerns **must remain** in the orchestrator because they wire across 3+ feature boundaries:

| Concern | Why It Stays |
|---------|-------------|
| Dialog state (`showConfirm`, `showPrompt`, `showFolderPicker`) | Shared infrastructure used by file ops, image insertion, batch ops, dirty close |
| `handleSave` / `handleRestore` / `openFileWithConversion` | Wires tabs (files) + proxy conversion + image APIs |
| Image proxy conversion | Cross-cuts files + editor + API |
| `handleFileSelect` | Cross-cuts dialogs + files + images |
| `handleCreateFileFromEditor` | Cross-cuts file ops + proxy + loadFiles |
| DOCX import/export, PDF export | Each uses 3-4 features |
| Batch selection handlers | Thin wrappers around file ops + dialogs |
| Session restore | Cross-cuts navigation + files |
| Auth transition + theme init | App-level bootstrap |
| Template modal state | Wires file creation + folder navigation |
| Game export modal state | Wires file content + LLM + save |
| Reminders/Bookmarks/Locations state | Called directly, not extracted |

---

## 6. When to Extract Code from App.tsx

Use this checklist to decide if code should be extracted into a feature module:

**Extract when ALL of these are true:**
- [ ] Single concern (one domain: layout, navigation, files, editor, etc.)
- [ ] 30+ lines of state + callbacks
- [ ] Does NOT wire 3+ other features together
- [ ] Can be tested in isolation
- [ ] Other components might need this state (justifies a Context)

**Do NOT extract when ANY of these are true:**
- [ ] Wires callbacks from 3+ different features
- [ ] Uses dialog state (`showConfirm`, `showPrompt`) from App.tsx
- [ ] Is a thin wrapper (~5 lines) around a single hook call
- [ ] Only App.tsx consumes the state

---

## 7. How to Add a New Feature

### Pattern A: Create a Feature Hook

```ts
// client/src/features/myFeature/useMyFeature.ts
import { useState, useCallback } from 'react';

export function useMyFeature(someDependency: () => void) {
  const [myState, setMyState] = useState<string>('');

  const doSomething = useCallback(() => {
    someDependency();
    setMyState('done');
  }, [someDependency]);

  return { myState, setMyState, doSomething };
}
```

### Pattern B: Wire Into App.tsx

```tsx
// In App.tsx imports:
import { useMyFeature } from './features/myFeature/useMyFeature';

// In App function (after hooks it depends on):
const myFeature = useMyFeature(someCallback);
const { myState, doSomething } = myFeature;

// In JSX:
<SomeComponent myState={myState} onAction={doSomething} />
```

### Pattern C: Create a Context (only for truly global state)

Use Context ONLY for:
- Auth (needed everywhere for API calls)
- Layout dimensions (needed by deeply nested components)

Do NOT use Context for:
- File operations (only needed by FileExplorer, Header, TabBar)
- Tab state (only needed by TabBar, DocumentEditor)
- Activity routing (only needed by ActivityBar, panel switcher)

**Memoize context values** to prevent re-renders:
```ts
const contextValue = useMemo(() => ({ a, b, c }), [a, b, c]);
```

---

## 8. Gotchas & Pitfalls

### `useFileOperations` manages undo/redo internally
Do NOT call `useFileSystemUndoRedo()` in App.tsx. It's already called inside `useFileOperations`.

### `showFolderPicker` is dependency injection
`useFileOperations(showFolderPicker)` receives the folder picker dialog function from App.tsx because dialog state lives there.

### `useGraph` is internal to `useGraphManager`
Do NOT call `useGraph()` directly in App.tsx. It's already called inside `useGraphManager`.

### Callback stability matters
All callbacks returned from feature hooks use `useCallback` with appropriate dependency arrays.

### `LayoutContext` / `AppLayout` are NOT wired
Both exist and compile but are not used in App.tsx JSX.

### `useSettings` is imported but may not be wired
`useSettings` is imported in App.tsx but settings state may still be managed inline. Check before refactoring.

### Hooks called directly in App.tsx (not extracted)
The following hooks are called directly in App.tsx, NOT through feature modules:
- `useBookmarks`, `useLocations`, `useReminders`, `useImageGeneration`
- `useTags`, `useSearch`, `useRecents`, `useLLM`
- `useSessionPersistence`, `useTheme`
- These are candidates for future extraction

### localStorage keys managed by features
- `wbu-left-width`, `wbu-right-width`, `wbu-search-width` — `useLayout`
- `wbu-ai-sidebar` — `useLayout`
- `wbu-left-panel-hidden` — `useLayout`
- `wbu_token`, `wbu_theme_settings` — App.tsx / useAuth

---

## 9. Current Feature Module Inventory

| Module | File | Wired? | Lines Saved |
|--------|------|--------|-------------|
| Layout | `useLayout.ts` | ✅ Yes | ~80 |
| Auth | `AuthProvider.tsx` | ✅ Yes (main.tsx) | ~20 |
| Navigation | `useActivityRouter.ts` | ✅ Yes | ~20 |
| Settings | `useSettings.ts` | ✅ Imported | ~10 |
| File Operations | `useFileOperations.ts` | ✅ Yes | ~100 |
| Batch Selection | `useBatchSelection.ts` | ⚠️ Exists | ~0 |
| Keyboard Shortcuts | `useKeyboardShortcuts.ts` | ✅ Yes | ~20 |
| Unsaved Warning | `useUnsavedWarning.ts` | ✅ Yes | ~15 |
| Image Conversion | `useImageConversion.ts` | ✅ Yes | ~75 |
| Graph Manager | `useGraphManager.ts` | ✅ Yes | ~40 |
| App Dialogs | `AppDialogs.tsx` | ✅ Yes | ~60 |
| Layout Context | `LayoutContext.tsx` | ❌ No | 0 |
| App Layout | `AppLayout.tsx` | ❌ No | 0 |
| **Total Saved** | | | **~440 lines** |

---

## 10. Extraction Candidates (Next Targets)

| Concern | Est. Lines | Priority | Reason |
|---------|-----------|----------|--------|
| Template modal wiring | ~40 | Medium | Self-contained state |
| Game export modal wiring | ~30 | Medium | Self-contained state |
| Image generation wiring | ~50 | Medium | useImageGeneration + callbacks |
| Reminders wiring | ~40 | Low | Already has hook |
| Bookmarks wiring | ~30 | Low | Already has hook |
| Locations wiring | ~30 | Low | Already has hook |
| Settings modal state | ~20 | Low | useSettings exists |

---

*Skill version: 2.0 — matches WORBI v6.2.40 architecture*