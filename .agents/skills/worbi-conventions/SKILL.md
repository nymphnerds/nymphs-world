---
name: worbi-conventions
description: WORBI conventions and common change patterns - naming, imports, feature-adding patterns, CSS, changelog, path safety, and code patterns for adding features
---

# WORBI Skill — Conventions & Common Change Patterns

Use this skill when **adding new features, modifying code, or following project conventions** in WORBI.

---

## 1. File Naming

| Type | Convention | Example |
|------|-----------|---------|
| React Components | PascalCase | `FileExplorer.tsx`, `ChatPanel.tsx` |
| Hooks | camelCase, `use` prefix | `useFiles.ts`, `useLLM.ts` |
| Services (server) | camelCase | `fileService.js`, `llmService.js` |
| Routes (server) | camelCase | `auth.js`, `files.js` |
| Extensions (TipTap) | kebab-case | `resize-image.ts`, `spellcheck.ts` |
| Pages | PascalCase | `Login.tsx`, `Settings.tsx` |
| CSS | kebab-case classes | `.search-highlight`, `.tag-badge-inline` |

---

## 2. Import Order

1. React / framework imports
2. Third-party libraries
3. Local components
4. Local hooks
5. Local services
6. Local types
7. Styles (last)

---

## 3. When Adding a New Feature

> **Two modes exist depending on whether `APP_TSX_REFACTOR` has been completed:**
> - **Before refactor (current):** Wire into `App.tsx` directly
> - **After refactor:** Wire into the appropriate feature hook in `client/src/features/`

**New API endpoint:** Add route in `server/src/routes/<domain>.js`, service logic in `server/src/services/<service>.js`, client call in `client/src/services/api.ts`.

**New AI tool:** Define in `toolService.js` `getToolDefinitions()` + `executeTool()`, add permission field in `config.js` `defaultUserSettings.toolPermissions`, add UI toggle in `Settings.tsx` Tools tab.

**New component:** Create in `client/src/components/`, wire into `App.tsx` JSX (or the appropriate feature hook after refactor), pass props from hooks.

**New hook:** Create in `client/src/hooks/`, call in `App.tsx` or consumer component (or the appropriate feature hook after refactor).

**New TipTap extension:** Create in `client/src/extensions/`, register in `DocumentEditor.tsx` extension arrays.

**New Settings tab:** Add to `SettingsTab` type union, add tab button, add content block with `{activeTab === 'newtab' && (...)}`.

---

## 4. CSS Rules

- **Primary method:** Tailwind utility classes in JSX
- **Custom CSS:** Only in `globals.css` for things Tailwind can't do (TipTap editor content, spellcheck underlines, search highlights, animations, scrollbar styling)
- **Never:** Inline `<style>` tags or CSS modules — use globals.css for custom styles
- **Dark theme only** — no light mode, no theme switching

---

## 5. CHANGELOG Format

Every change must be documented in `CHANGELOG.md`:
```
## vX.Y.Z — Short Title (date)

- **Feature description** — What changed and why
- Bullet points for each change

### Files Changed
- `path/to/file` — What was changed

---
```

---

## 6. Path Safety (CRITICAL)

Any server-side code that reads/writes files based on user input MUST use path traversal protection:
- `fileService.getSafePath(username, relPath)` — for user workspace files
- `fileService.getSafeImagePath(username, imageName)` — for user assets
- `toolService.resolveSafePath(userPath)` — for AI tool file access
- All use `path.normalize()` + prefix checking to ensure resolved path stays within allowed directory

---

## 7. Common Change Patterns

### "Add a new button to the editor toolbar"

1. Import icon from `lucide-react` in `DocumentEditor.tsx`
2. Add button in the toolbar JSX with the icon
3. Add click handler that calls a TipTap command (`.chain().focus()...`)
4. Style: inactive = `text-[#e0e0e0] hover:bg-[#2a2a3a]`, active = `bg-[#a78bfa] text-white`
5. Update CHANGELOG

### "Add a new API endpoint"

1. Add route handler in `server/src/routes/<file>.js`
2. If business logic is complex, add a function in `server/src/services/<file>.js`
3. If the client needs it, add a function in `client/src/services/api.ts` with proper types
4. Update `docs/handoff/` if this is a significant new capability
5. Update CHANGELOG

### "Modify the AI tools system"

1. Tool definitions: `toolService.js` → `getToolDefinitions()`
2. Tool execution: `toolService.js` → `executeTool()`
3. Permissions: `config.js` → `defaultUserSettings.toolPermissions`
4. UI: `Settings.tsx` → Tools tab
5. Client types: `api.ts` → `ToolPermissions` interface
6. Chat integration: `llmService.js` → `sendChatMessage()` tool-calling loop

###

### "Add a new Activity Bar item"

1. Add to `ActivityType` type union in `App.tsx`
2. Add icon button in `ActivityBar.tsx`
3. Add conditional rendering in the left panel section of `App.tsx`
4. Create the panel component in `client/src/components/`

### "Add a new feature hook"

1. Create `client/src/features/<domain>/use<MyFeature>.ts`
2. Hook returns state + callbacks, receives dependencies as parameters
3. Wire into `App.tsx` in dependency order (see `worbi-app-refactor` skill)
4. Pass state/callbacks as props to components — do NOT lift to Context unless 3+ deeply nested consumers

### "Add a new game template"

1. Add server template in `server/src/data/templates/<name>.txt` (HTML format with `<h2>`/`<p>`)
2. Add type to `templateService.js` template config (name, defaultFolder, prompt, sections)
3. Add detection pattern in `client/src/utils/templateDetector.ts`
4. Add export prompt in `client/src/utils/gameGeneratorPrompts.ts` + `client/src/templates/game-generator/<name>-prompt.txt`
5. Add template card in `NewFromTemplateModal.tsx` Game section

### "Add a new game export type"

1. Add prompt template in `client/src/templates/game-generator/<name>-prompt.txt`
2. Add to `gameGeneratorPrompts.ts` export map
3. Add template type detection in `templateDetector.ts` (folder-based)
4. Update `GameExportModal.tsx` if new options needed
5. Export saves to `docs/GameReady/` as `.txt`

### "Configure LLM Connection" (Since v6.2.52)

**IMPORTANT:** All LLM connections are external and user-managed. WORBI does NOT auto-detect local LLM servers or manage server lifecycle (start/stop). The `llmLifecycle.js` and `llmDetector.js` services were removed in v6.2.52.

When working with LLM configuration:
1. LLM Settings UI is in `Settings.tsx` → LLM tab (Provider, URL, API Key, Model, Max Tokens, Temperature, Top P)
2. LLM connection state stored in user settings file: `server/data/user-settings/<username>-settings.json`
3. Users must start/stop their LLM server (e.g., llama.cpp) externally before configuring WORBI
4. There is NO `POST /api/llm/detect` endpoint — do not call it
5. There is NO managed server start/stop — do not add these features back
6. Connection mode is always external; there are no "Managed" or "External" toggle buttons
7. **Pitfall (v6.2.57):** In `Settings.tsx`, the initial sync `useEffect` that copies hook settings to form state MUST guard against empty defaults. Use `&& settings.baseUrl` in the condition to ensure real settings trigger the sync, not empty defaults. Without this guard, the provider dropdown shows the first option ("LM Studio") instead of the saved provider due to a race condition.

---

## 8. Document File Naming Convention (CRITICAL)

**All files created by templates are `.html` files** — This includes both Game templates (Character, Quest, Location, Item, Faction, Creature, Timeline) and Work templates (Customer, Job, Booking, Quote).

**The ONLY `.txt` files in the system are game exports** generated via the "Generate Game File" button (Game Export Modal) — these go to `docs/GameReady/` for the game engine.

**Key conventions:**
- **Storage:** Files are saved as `.html` on disk (TipTap is an HTML-only editor)
- **Display:** File Explorer strips `.html` extension using `displayName()` so users see clean names like "cray - NPC" not "cray - NPC.html"
- **Rename:** Inline rename auto-appends `.html` if the user omits an extension
- **Metadata:** Build/Template metadata uses HTML comment format: `<!-- Build: Yes -->\n<!-- Template: Character -->` (invisible in editor, parseable by `storyFileDetector.ts`)
- **Template service:** `templateService.js` has NO `.txt` suffix logic — all templates produce `.html` with `<h2>`/`<p>` structure

**When adding new templates:**
1. Use HTML format with `<!-- Build: Yes -->` + `<!-- Template: <Type> -->` metadata comments
2. Use `<h2>` for section headings, `<p>` for field descriptions
3. Set `.html` extension (no special logic needed — it's the default)
4. Set `defaultFolder` to match folder names used by `templateDetector.ts` if game-related

---

## 9. Per-User localStorage Isolation (CRITICAL)

**Skill files location:** `/home/nymph/.agents/skills/<skill_name>/SKILL.md` — update relevant skills when discovering new patterns.

**WORBI is a multi-user application.** Each user has their own settings, preferences, and state stored in localStorage. **Cross-user data leakage must be prevented.**

### Rules

1. **Always use user-scoped localStorage keys:** `wbu_${user.username}_<feature>` (e.g., `wbu_alice_sidebar_visibility`)
2. **NEVER fall back to a global `wbu_<feature>` key** — when `user` is null (during login/logout transition), return conservative defaults (all off/hidden), do NOT read from a shared global key
3. **Use `user?.username` string in React dependencies** — not the `user` object reference, for reliable re-computation on login/logout. Object references may not change but the username will.
4. **Add explicit `useEffect` on `user?.username` to force re-read:** The `storage` event only fires in **other browser tabs**, not the current tab. If a hook reads from user-scoped localStorage, it MUST include:
   ```typescript
   useEffect(() => {
     setRefreshKey(k => k + 1); // force useMemo re-read from localStorage
   }, [user?.username]);
   ```
5. **Guard writes with `if (!user?.username) return;`** — prevent writes to localStorage during transitional states where user is null
6. **Null user = conservative defaults** — return defaults (all hidden, all off, empty) when user is not available. Never guess or inherit.

### Pattern: User-Scoped localStorage Hook

```typescript
const { user } = useAuthContext();
const [refreshKey, setRefreshKey] = useState(0);

// Force re-read when user changes (storage event won't fire in same tab)
useEffect(() => {
  setRefreshKey(k => k + 1);
}, [user?.username]);

// Listen for external changes
useEffect(() => {
  const handler = () => setRefreshKey(k => k + 1);
  window.addEventListener('custom-change-event', handler);
  return () => window.removeEventListener('custom-change-event', handler);
}, []);

const data = useMemo(() => {
  void refreshKey;
  if (!user?.username) return defaultValue; // conservative default, NO global fallback
  try {
    const raw = localStorage.getItem(`wbu_${user.username}_feature`);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}, [user?.username, refreshKey]);

const setData = useCallback((newData) => {
  if (!user?.username) return; // guard write
  localStorage.setItem(`wbu_${user.username}_feature`, JSON.stringify(newData));
  setRefreshKey(k => k + 1);
  window.dispatchEvent(new Event('custom-change-event'));
}, [user?.username]);
```

### Anti-Patterns (DO NOT DO)

- **Global fallback key:** `const key = user ? `wbu_${user.username}_x` : 'wbu_x';` — causes cross-user leakage
- **Object reference in deps:** `useEffect(() => { ... }, [user]);` — object reference may not trigger on login
- **Relying only on `storage` event:** The `storage` event only fires in **other tabs**, not the current tab
- **Writing without user guard:** `localStorage.setItem(key, ...)` without checking `if (!user?.username) return;`

### Discovered During: Sidebar Icon Visibility Bug (May 2026)

- `useLayout.ts` used global fallback `wbu_sidebar_visibility` when user was null during login transition
- `Settings.tsx` had same issue — both read/wrote to global key during user state transitions
- Fix: removed global fallback, added `user?.username` to useMemo deps, added explicit useEffect to force refresh on user change