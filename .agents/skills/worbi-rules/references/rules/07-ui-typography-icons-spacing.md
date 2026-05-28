# WORBI UI — Typography, Icons & Spacing

Use this skill when working with **text styling, icons, and spacing** in WORBI.

---

## 1. Typography

### Font Family
```css
font-family: Inter, system-ui, -apple-system, sans-serif;
```
- **UI text:** Inter (loaded from Google Fonts in `index.html`)
- **Editor content:** Inherited from TipTap (serif/sans-serif based on document)
- **Code blocks:** `font-mono` (system monospace)

### Type Scale

| Element | Weight | Size | Tailwind | CSS Class |
|---------|--------|------|----------|-----------|
| Page title | 600 | text-lg | `font-semibold text-lg` | — |
| Section heading | 600 | text-sm | `font-semibold text-sm` | `.section-heading` |
| Modal title | 600 | text-[0.9rem] | — | `.modal-header` |
| Body text | 400 | text-sm | `text-sm` | — |
| Labels | 500 | text-xs | `font-medium text-xs uppercase tracking-wider` | — |
| Small hints | 400 | text-[11px] | `text-[11px] text-[#888]` | — |
| Code blocks | 400 | text-sm | `font-mono text-sm` | — |
| Button text | 500 | text-[0.8rem] | — | `.btn-primary`, `.btn-secondary` |

### Font Weights

| Weight | Tailwind | Usage |
|--------|----------|-------|
| 400 (regular) | `font-normal` | Body text, descriptions |
| 500 (medium) | `font-medium` | Labels, buttons, section headers |
| 600 (semibold) | `font-semibold` | Titles, headings, emphasis |

---

## 2. Icon Library

**Use `lucide-react` exclusively.** Do NOT introduce other icon libraries.

### Common Icons by Component

| Component | Icons |
|-----------|-------|
| Activity Bar | `LayoutDashboard`, `Search`, `Tag`, `Star`, `MapPin`, `Clock`, `Share2`, `Bell`, `Bookmark`, `Settings` |
| Toolbar | `Bold`, `Italic`, `Strikethrough`, `List`, `ListOrdered`, `Quote`, `Code`, `Link`, `Image`, `FilePlus`, `Save`, `Download`, `Undo2`, `Redo2` |
| File ops | `FileText`, `FolderOpen`, `FolderPlus`, `Trash2`, `ArrowLeftRight` (rename), `Copy` |
| Chat | `Send`, `Sparkles`, `Bot`, `User` |
| Graph | `Share2`, `Network`, `GitGraph` |
| Modals | `X`, `Check`, `AlertCircle`, `Info`, `Eye`, `EyeOff`, `RefreshCw`, `LogOut` |
| Navigation | `ChevronLeft`, `ChevronRight`, `ChevronDown`, `ChevronUp`, `Home` |

### Icon Sizing

| Context | Size |
|---------|------|
| Activity bar | `w-5 h-5` |
| Toolbar | `w-4 h-4` |
| Buttons | `w-4 h-4` or `w-3.5 h-3.5` |
| Inline | `w-3 h-3` |

---

## 3. Spacing Scale

WORBI uses tight spacing (VS Code-style):

| Context | Padding | Margin |
|---------|---------|--------|
| Activity bar | `p-2.5` (10px) | — |
| Toolbar buttons | `p-0.5` (2px) | — |
| File tree items | `px-2 py-0.5` | — |
| Tab bar | `px-3 py-1.5` | — |
| Modal content | `p-1rem` | — |
| Form fields | `gap-3` | `mt-1` label |
| Section dividers | `py-3 border-b border-[#2a2a3a]` | — |

### Gap Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` | 4px | Tight inline spacing |
| `gap-1.5` | 6px | Button groups |
| `gap-2` | 8px | Standard spacing |
| `gap-3` | 12px | Form fields, sections |

---

## 4. CSS Architecture

```
client/src/styles/
├── globals.css            Entry point — imports all partials
├── _theme.css             CSS custom properties (HSL), light/dark mode, global resets, .btn-primary, .btn-secondary
├── _layout.css            Scrollbars, .container-panels, .content-area, .gutter, .save-btn-pulse
├── _editor.css            TipTap editor content, .task-item, .table-wrapper, spellcheck, .search-highlight, .wikilink-hover
├── _chat.css              Chat bubbles, AI/user messages, tool status
├── _tags.css              .tag-badge, .tag-badge-inline, tag colors, tag management UI
├── _timeline.css          .timeline-line, .timeline-dot, era grouping
├── _modals.css            .modal-overlay, .modal-content, .modal-header, .modal-body, .modal-footer, .dialog-overlay
└── _components.css        .toggle-switch, .toggle-delete, .skeleton-pulse, .dropdown-menu, .spinner, .avatar-badge, .tooltip
```

**Rule:** Tailwind for layout/component structure. Custom CSS only for TipTap editor content, animations, and states that can't be expressed with utilities.