# WORBI — Backend, Auth & Storage

## Backend Service Architecture

```
server/src/
├── index.js                 (Express app, middleware, route mounting)
├── config.js                (server config, defaultUserSettings, toolPermissions)
│
├── routes/                  (HTTP endpoint handlers)
│   ├── auth.js              → authService
│   ├── files.js             → fileService, tagService, templateService
│   ├── llm.js               → llmService, toolService
│   ├── settings.js          → config.js (load/save settings)
│   ├── reminders.js         → reminderService
│   ├── timeline.js          → timeline metadata (inline, uses tagService)
│   ├── images.js            → static image serving
│   ├── imageGeneration.js   → imageGenLifecycle
│   └── graph.js             → tagService, llmService, locationService (inline)
│
├── middleware/
│   └── authMiddleware.js    (JWT verification, attaches req.user)
│
└── services/                (business logic, no HTTP concerns)
    ├── authService.js       (loginOrCreate, verifyToken, getUserWorkspaceDir)
    ├── fileService.js       (CRUD, search, upload, path safety)
    ├── llmService.js        (chat completion, model fetch, tool-calling loop)
    ├── toolService.js       (7 AI tools: definitions + execution)
    ├── tagService.js        (tag CRUD, file metadata, relationships)
    ├── templateService.js   (document template generation)
    ├── reminderService.js   (reminder CRUD, firing, recurrence, threading)
    ├── locationService.js   (file location metadata CRUD)
    ├── imageGenLifecycle.js (Z-Image server lifecycle)
    └── providerCatalog.js   (LLM provider catalog data)
```

**Pattern:** Routes are thin — they parse input, call services, return responses. Services contain business logic and file system operations.

### Path Safety (CRITICAL)

All file system access uses path traversal protection:
```javascript
// fileService.js
function getSafePath(username, relPath) {
  const base = path.join(__dirname, '../../data/users', username, 'workspace');
  const normalized = path.normalize(relPath).replace(/^[..]+[/\\]/, '');
  const fullPath = path.join(base, normalized);
  if (!fullPath.startsWith(base)) throw new Error('Path traversal detected');
  return fullPath;
}
```

## TipTap Extension System

```
client/src/extensions/
├── resize-image.ts          (custom Image extension with resize handles)
│   - Extends Image from '@tiptap/extension-image'
│   - Adds drag handles for resize
│   - Handles blob: URLs → upload bridge
│
└── spellcheck.ts            (typo-js integration)
    - Integrates typo-js spellchecker
    - Renders underlines via custom view
    - Uses /public/dictionaries/en_US/ hunspell files
```

**Extensions registered in `DocumentEditor.tsx`:**
```typescript
extensions: [
  StarterKit, Placeholder, ResizeImage, Spellcheck,
  // Tag extensions (inline mentions for [[tag]] syntax)
  // Link extension for external URLs
  // WikiLink extension for [[Document Name]] cross-doc links
]
```

## Auth Flow (Detailed)

```
Client Side:
1. Page load → check localStorage('wbu_token')
2. If token exists → set authState.loggedIn = true, show App
3. If no token → show Login.tsx

Login Flow:
4. User enters username → POST /api/auth/login { username }
5. Server: authService.loginOrCreate(username)
   a. Check server/data/users.json for username
   b. If not found → create user entry, create workspace directory
   c. Generate JWT with 7d expiry
   d. Return { token, user: { username, isNewUser, createdAt, lastLogin } }
6. Client stores token in localStorage
7. Set authState, render App

Protected Request:
8. fetch('/api/files', { headers: { Authorization: 'Bearer <token>' } })
9. Server: authMiddleware verifies JWT signature + expiry
10. Attaches req.user = { username } to request
11. Route handler uses req.user.username for user-specific operations

Logout:
12. Clear localStorage('wbu_token')
13. Reset authState → shows Login.tsx
```

## Storage Layout

```
server/data/
├── users.json                         (user registry: username → metadata)
│
├── users/<username>/
│   ├── workspace/                     (user documents)
│   │   ├── MyDocument.json
│   │   ├── Lore/
│   │   │   ├── Characters.json
│   │   │   └── Locations.json
│   │   ├── .wbu_timeline_metadata.json (hidden dotfile)
│   │   └── ...
│   │
│   └── assets/
│       └── images/                    (uploaded images)
│           ├── hero-sunset.jpg
│           └── ...
│
├── user-settings/
│   └── <username>-settings.json       (per-user app settings)
│
└── templates/                         (server-side game templates)
    ├── character.txt
    ├── quest.txt
    └── ...
```

## Architecture Status

| Change | Current State | Status |
|--------|--------------|--------|
| App.tsx | ~1,376 lines, partially decomposed | 🔄 In Progress (~430 lines saved) |
| Database | JSON files on disk | ⏳ Planned (SQLite migration) |
| LLM Config | Provider catalog + external-only | ✅ Done |
| Binary Detection | REMOVED since v6.2.52 | ✅ Done |
| Image URLs | Persistent upload bridge | ✅ Done |
| Cross-doc Links | `[[bracket]]` syntax with nav | ✅ Done |
| Version History | Not supported | ⏳ Planned |
| Blob URL Bridge | Fixed | ✅ Done |
| WikiLinks | Implemented | ✅ Done |
| Timeline View | Implemented | ✅ Done |
| Relationship Graph | Implemented | ✅ Done |
| Reminders | Implemented | ✅ Done |
| Game File Export | Implemented | ✅ Done |
| Image Generation | Implemented | ✅ Done |