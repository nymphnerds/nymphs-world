---
name: worbi-project
description: WORBI project identity, tech stack, full directory map, and handoff document index with toggle guide
---

# WORBI Skill — Project Identity & Directory Map

Use this skill when working on **WORBI by Nymphs**, a rich text world-building document editor.

---

## 1. Project Identity

| Attribute | Value |
|-----------|-------|
| **Name** | WORBI by Nymphs |
| **Tagline** | WorldBuilder UI |
| **Purpose** | Rich text document editor for world-building — write stories, design quests, build character sheets, organize lore |
| **Version** | 6.2.40 |
| **License** | MIT |
| **Repo** | `github.com/rauty79/worbi` |

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18+, TypeScript 5.0+, Vite, Tailwind CSS, TipTap (ProseMirror) |
| Backend | Node.js, Express, Multer |
| Auth | JWT tokens (7d expiry), localStorage |
| LLM | OpenAI-compatible chat completions API |
| Graph Viz | Cytoscape.js (force-directed relationship graphs) |
| Package Manager | npm workspaces (root `package.json` orchestrates `server/` and `client/`) |

---

## 2. Directory Map

```
WORBI/
├── .cline/skills/                  ← Skill files (toggle-able)
├── package.json                     ← Workspace root (npm workspaces)
├── README.md
├── CHANGELOG.md                     ← Versioned changelog (v6.2.40 latest)
├── update_record.md                 ← Detailed update records (984 lines)
├── .env.example
│
├── server/                          ← Express.js backend
│   ├── src/
│   │   ├── index.js                 ← Express app setup, route mounting
│   │   ├── config.js                ← Server config, user settings, providerCatalog
│   │   ├── routes/
│   │   │   ├── auth.js              ← POST /auth/login, /auth/register
│   │   │   ├── files.js             ← File CRUD, upload, search, tag, template routes
│   │   │   ├── llm.js               ← Chat, models, test, detect, providers, graph
│   │   │   ├── settings.js          ← User settings get/put
│   │   │   ├── reminders.js         ← Reminder CRUD, thread, check, grouped
│   │   │   ├── timeline.js          ← Timeline entries, metadata, suggest-date
│   │   │   ├── images.js            ← Image serve from assets
│   │   │   ├── imageGeneration.js   ← Z-Image AI generation endpoints
│   │   │   └── graph.js             ← Relationship graph generation (seed-based)
│   │   ├── services/
│   │   │   ├── authService.js       ← loginOrCreate, verifyToken, getUserWorkspaceDir
│   │   │   ├── fileService.js       ← File CRUD, search, upload, path safety
│   │   │   ├── llmService.js        ← Chat completion, tool-calling loop
│   │   │   ├── llmLifecycle.js      ← LLM server lifecycle management
│   │   │   ├── llmDetector.js       ← Local LLM port detection
│   │   │   ├── toolService.js       ← 8 AI tools
│   │   │   ├── tagService.js        ← Tag CRUD, file metadata, relationships
│   │   │   ├── templateService.js   ← Document template generation (7 game + work)
│   │   │   ├── reminderService.js   ← Reminder CRUD, firing, recurrence, threading
│   │   │   ├── locationService.js   ← File location metadata CRUD
│   │   │   ├── imageGenLifecycle.js ← Z-Image server lifecycle
│   │   │   └── providerCatalog.js   ← LLM provider catalog (16+ providers)
│   │   └── middleware/
│   │       └── authMiddleware.js    ← JWT verification
│   └── data/
│       ├── users/<username>/workspace/
│       ├── users/<username>/assets/images/
│       ├── user-settings/<username>-settings.json
│       └── templates/               ← Server-side game templates
│           ├── character.txt
│           ├── quest.txt
│           ├── location.txt
│           ├── item.txt
│           ├── faction.txt
│           ├── creature.txt
│           └── timeline.txt
│
├── client/                          ← React + Vite frontend
│   └── src/
│       ├── main.tsx                 ← React entry, wraps <App> with <AuthProvider>
│       ├── App.tsx                  ← Main orchestrator (~1,376 lines)
│       ├── components/              ← UI components (47 total)
│       │   ├── ActivityBar.tsx
│       │   ├── AppDialogs.tsx
│       │   ├── BookmarkSidebar.tsx
│       │   ├── ChatPanel.tsx
│       │   ├── CompileStoryBibleModal.tsx
│       │   ├── ConfirmDialog.tsx
│       │   ├── DocumentEditor.tsx
│       │   ├── EmojiPicker.tsx
│       │   ├── ErrorBoundary.tsx
│       │   ├── FileExplorer.tsx
│       │   ├── FilePickerModal.tsx
│       │   ├── FolderPickerDialog.tsx
│       │   ├── GameExportModal.tsx
│       │   ├── GenerateDocumentModal.tsx
│       │   ├── GenerateImageModal.tsx
│       │   ├── GraphModal.tsx
│       │   ├── Header.tsx
│       │   ├── HelpPanel.tsx
│       │   ├── HeroImagePicker.tsx
│       │   ├── ImageExplorer.tsx
│       │   ├── ImageGeneratorPanel.tsx
│       │   ├── ImagePreview.tsx
│       │   ├── ImageViewer.tsx
│       │   ├── InformationPanel.tsx
│       │   ├── InlineRenameInput.tsx
│       │   ├── KeyboardShortcutSettings.tsx
│       │   ├── LocationManager.tsx
│       │   ├── MiniGraphPreview.tsx
│       │   ├── NameGenerator.tsx
│       │   ├── NewFromTemplateModal.tsx
│       │   ├── ProfileSelectorModal.tsx
│       │   ├── PromptDialog.tsx
│       │   ├── RelationshipGraphSidebar.tsx
│       │   ├── RelationshipsPanel.tsx
│       │   ├── ReminderSidebar.tsx
│       │   ├── SearchPanel.tsx
│       │   ├── StarredFiles.tsx
│       │   ├── StatusBar.tsx
│       │   ├── TabBar.tsx
│       │   ├── TagInsertControl.tsx
│       │   ├── TagManager.tsx
│       │   ├── ThemePicker.tsx
│       │   ├── TimelineView.tsx
│       │   ├── Welcome.tsx
│       │   ├── WikiLinkAutocomplete.tsx
│       │   └── WikiLinkPopover.tsx
│       ├── features/                ← Feature modules (orchestrator pattern)
│       │   ├── auth/
│       │   │   └── AuthProvider.tsx
│       │   ├── editor/
│       │   │   ├── useImageConversion.ts
│       │   │   └── useUnsavedWarning.ts
│       │   ├── files/
│       │   │   ├── useFileOperations.ts
│       │   │   └── useBatchSelection.ts
│       │   ├── graph/
│       │   │   └── useGraphManager.ts
│       │   ├── keyboard/
│       │   │   └── useKeyboardShortcuts.ts
│       │   ├── layout/
│       │   │   ├── useLayout.ts
│       │   │   ├── LayoutContext.tsx
│       │   │   └── AppLayout.tsx
│       │   └── navigation/
│       │       ├── useActivityRouter.ts
│       │       └── useSettings.ts
│       ├── hooks/                   ← Custom hooks
│       │   ├── useAuth.ts
│       │   ├── useBookmarks.ts
│       │   ├── useFiles.ts
│       │   ├── useFileSystemUndoRedo.ts
│       │   ├── useGraph.ts
│       │   ├── useImageGeneration.ts
│       │   ├── useKeyboardShortcuts.ts
│       │   ├── useLLM.ts
│       │   ├── useLocations.ts
│       │   ├── useRecents.ts
│       │   ├── useReminders.ts
│       │   ├── useSearch.ts
│       │   ├── useSessionPersistence.ts
│       │   ├── useTags.ts
│       │   └── useTheme.ts
│       ├── extensions/              ← TipTap extensions
│       │   ├── resize-image.ts
│       │   └── spellcheck.ts
│       ├── pages/
│       │   ├── Login.tsx
│       │   └── Settings.tsx
│       ├── services/
│       │   └── api.ts               ← All API calls + TypeScript types
│       ├── utils/
│       │   ├── storyFileDetector.ts ← Build/Template metadata detection
│       │   ├── templateDetector.ts  ← Game template type detection from folder
│       │   └── gameGeneratorPrompts.ts ← LLM prompts for game file export
│       ├── templates/
│       │   └── game-generator/      ← Prompt templates for game export
│       │       ├── npc-prompt.txt
│       │       ├── mainstory-prompt.txt
│       │       └── ... (one per template type)
│       └── styles/
│           ├── globals.css          ← Dark theme globals
│           └── _editor.css          ← TipTap editor styles
│
└── docs/
    ├── handoff/
    │   ├── priority-high/
    │   ├── priority-medium/
    │   ├── priority-low/
    │   └── COMPLETED_TODAY.md
    ├── GameStoryTemplates/          ← Game engine reference templates
    │   ├── NPCs/
    │   │   ├── elder_miyako.txt
    │   │   └── NoticeBoardAgent.txt
    │   └── QuestArcs/
    │       └── village_defense_arc.txt
    └── legacy/
```

---

## 3. Handoff Document Toggle Guide

| Handoff Doc | Priority | Toggle On When... | Depends On |
|-------------|----------|-------------------|------------|
| `TEST_SUITE_SETUP.md` | 🔴 High | Setting up tests | — |
| `HARDCODED_CONFIG_CLEANUP.md` | 🟡 Medium | Cleaning up config | — |
| `DATABASE_MIGRATION.md` | 🔴 High | Migrating to SQLite | — |
| `LLM_PROVIDER_CONFIG_REDESIGN.md` | 🔴 High | Redesigning LLM config UI | `HARDCODED_CONFIG_CLEANUP` |
| `APP_TSX_REFACTOR.md` | 🟡 Medium | Decomposing App.tsx (in progress) | — |
| `CROSS_DOCUMENT_WIKILINKS.md` | 🔴 High | WikiLinks implemented | ✅ Done |
| `DOCUMENT_VERSION_HISTORY.md` | 🔴 High | Adding revision tracking | `DATABASE_MIGRATION` |
| `AI_WRITING_ENHANCEMENTS.md` | 🔴 High | AI completions | ✅ Partially done |
| `SESSION_PERSISTENCE.md` | 🟡 Medium | Session persistence | ✅ Done |
| `DOCUMENT_TEMPLATES.md` | 🟡 Medium | Templates | ✅ Done |
| `MARKDOWN_AND_EXPORT_FORMATS.md` | 🟡 Medium | Markdown/export | ✅ Partially done |
| `RELATIONSHIP_GRAPH.md` | 🟡 Medium | Relationship graph | ✅ Done |
| `TIMELINE_VIEW.md` | 🟡 Medium | Timeline view | ✅ Done |
| `BINARY_DETECTION_UNIFICATION.md` | 🟢 Low | Unifying binary detection | — |
| `RATE_LIMITING_AND_CACHING.md` | 🟢 Low | Adding rate limiting | — |
| `FOCUS_MODE.md` | 🟢 Low | Adding focus mode | `APP_TSX_REFACTOR` |
| `WORLD_MAP_INTEGRATION.md` | 🟢 Low | Adding world map | `CROSS_DOCUMENT_WIKILINKS` |

**Status Key:**
- ✅ Done = Feature implemented and working
- 🔴 High = Priority task, not yet started
- 🟡 Medium = Important but not urgent
- 🟢 Low = Nice-to-have

---

## 4. Key Features Implemented

| Feature | Status | Version Introduced |
|---------|--------|-------------------|
| Rich Text Editor (TipTap) | ✅ | v2.x |
| File/Folder CRUD | ✅ | v2.x |
| Tag System | ✅ | v5.x |
| AI Chat Panel | ✅ | v5.x |
| AI Tools (8 tools) | ✅ | v5.x |
| WikiLinks `[[name]]` | ✅ | v6.0 |
| Timeline View | ✅ | v6.0 |
| Relationship Graph | ✅ | v6.0 |
| Reminders | ✅ | v6.1 |
| Document Templates (7 game + 4 work) | ✅ | v6.0 |
| Game File Export | ✅ | v6.2 |
| Image Generation (Z-Image) | ✅ | v6.0 |
| Workspace Profiles (Game/Work) | ✅ | v6.1 |
| Theme & Colour Settings | ✅ | v6.0 |
| Session Persistence | ✅ | v6.0 |
| Inline Rename | ✅ | v6.1 |
| Batch File Operations | ✅ | v6.0 |
| Emoji Picker | ✅ | v6.0 |
| Bookmarks/Outline | ✅ | v6.0 |
| Keyboard Shortcuts (bindable) | ✅ | v6.0 |
| Story Bible Compiler | ✅ | v6.0 |
| Location Metadata | ✅ | v6.0 |
| Name Generator | ✅ | v6.0 |
| Document Generation from Prompts | ✅ | v6.0 |
| DOCX Import/Export | ✅ | v5.x |
| PDF Export | ✅ | v5.x |
| Custom Dialogs (Confirm/Prompt/FolderPicker) | ✅ | v6.0 |
| Unsaved Changes Warning | ✅ | v6.0 |
| LLM Provider Catalog (16+ providers) | ✅ | v6.0 |
| Managed LLM Server | ✅ | v6.0 |
| Collapsible Sidebar | ✅ | v6.0 |
| Icon Visibility Settings | ✅ | v6.2 |