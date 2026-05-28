# WORBI — Frontend Architecture

## Component Tree

```
App.tsx (main orchestrator)
├── Login.tsx                    (shown when not authenticated, via AuthProvider)
├── Welcome.tsx                  (landing screen after login, no file selected)
│
├── ActivityBar.tsx              (leftmost 48px icon bar)
│   └── Activities: files, search, tags, starred, locations, timeline, graph, reminders, settings
│
├── Left Panel (switches by activity)
│   ├── FileExplorer.tsx         (file tree, breadcrumbs, context menus, inline rename)
│   ├── SearchPanel.tsx          (full-text search results)
│   ├── TagManager.tsx           (tag CRUD panel)
│   ├── StarredFiles.tsx         (favorites list)
│   ├── LocationManager.tsx      (location metadata CRUD)
│   ├── TimelineView.tsx         (chronological view grouped by era)
│   ├── RelationshipGraphSidebar.tsx (graph controls, filters)
│   ├── ReminderSidebar.tsx      (reminders list, create, thread)
│   ├── BookmarkSidebar.tsx      (heading bookmarks)
│   └── HelpPanel.tsx            (help/shortcuts panel)
│
├── Header.tsx                   (logo, file menu, AI toggle, profile selector, game export)
├── TabBar.tsx                   (file tabs with dirty indicators, close buttons)
│
├── Main Content Area
│   ├── DocumentEditor.tsx       (two-column: editor + information panel)
│   │   ├── Toolbar              (formatting buttons, File+ dropdown)
│   │   ├── TipTap Editor        (left column, rich text)
│   │   │   ├── ContentEditable  (TipTap content)
│   │   │   ├── TagInsertControl (inline tag dropdown)
│   │   │   ├── WikiLinkAutocomplete ([[name]] autocomplete)
│   │   │   └── WikiLinkPopover  (hover popover for wiki links)
│   │   └── InformationPanel.tsx (right column)
│   │       ├── HeroImage        (clickable, opens picker)
│   │       ├── Tags List        (badges with colors)
│   │       ├── Relationships    (linked files display)
│   │       ├── MiniGraphPreview (interactive graph viz)
│   │       ├── Timeline metadata controls
│   │       └── Location controls
│   │
│   └── ChatPanel.tsx            (AI chat sidebar, right side)
│       ├── Messages List        (user/assistant bubbles)
│       ├── Input Area           (textarea + send button)
│       └── Tool Status          (execution indicators)
│
├── StatusBar.tsx                (bottom status bar)
│
├── Modals & Overlays
│   ├── Settings.tsx             (settings modal with tabs)
│   ├── NewFromTemplateModal.tsx (template selection dialog)
│   ├── CompileStoryBibleModal.tsx (story bible compiler)
│   ├── GenerateDocumentModal.tsx (AI document generation)
│   ├── GameExportModal.tsx      (game file export wizard)
│   ├── GenerateImageModal.tsx   (AI image generation)
│   ├── ImageGeneratorPanel.tsx  (Z-Image panel)
│   ├── HeroImagePicker.tsx      (modal for selecting hero image)
│   ├── ImageExplorer.tsx        (image browsing grid)
│   ├── ImageViewer.tsx          (full image viewer modal)
│   ├── ImagePreview.tsx         (single image preview)
│   ├── ProfileSelectorModal.tsx (workspace profile selection)
│   ├── GraphModal.tsx           (full graph visualization modal)
│   ├── NameGenerator.tsx        (AI name generator)
│   ├── ThemePicker.tsx          (theme/color picker)
│   ├── EmojiPicker.tsx          (emoji selection)
│   ├── KeyboardShortcutSettings.tsx (bindable shortcuts)
│   ├── ConfirmDialog.tsx        (styled confirm replacement)
│   ├── PromptDialog.tsx         (styled prompt replacement)
│   ├── FolderPickerDialog.tsx   (folder tree picker)
│   ├── FilePickerModal.tsx      (file picker)
│   └── AppDialogs.tsx           (dialog wrapper component)
│
└── ErrorBoundary.tsx            (React error boundary wrapper)
```

## State Management

- **No external state management library** (no Redux, no Zustand). All state lives in React hooks called from `App.tsx` and passed down as props.
- Key hooks: `useAuth()`, `useFiles()`, `useLLM()`, `useRecents()`, `useSearch()`, `useTags()`, `useBookmarks()`, `useLocations()`, `useReminders()`, `useImageGeneration()`, `useSessionPersistence()`, `useTheme()`