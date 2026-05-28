# WORBI UI — Animations, States & Custom CSS

## 1. Animations (from _layout.css & _components.css)

### Save Button Pulse (`.save-btn-pulse`)
```css
@keyframes save-btn-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgb(var(--primary) / 0.4); }
  50% { box-shadow: 0 0 8px 2px rgb(var(--primary) / 0.6); }
}
.save-btn-pulse { animation: save-btn-pulse 2s ease-in-out infinite; }
```
Applied to Save button when current file has unsaved changes (dirty tab).

### Skeleton Pulse (`.skeleton-pulse`)
```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.7; }
}
.skeleton-pulse { background: rgb(var(--muted)); animation: skeleton-pulse 1.5s ease-in-out infinite; }
```
Used for loading placeholders.

### Spinner (`.spinner`)
```css
@keyframes spin { to { transform: rotate(360deg); } }
.spinner {
  border: 2px solid rgb(var(--border)); border-top-color: rgb(var(--primary));
  border-radius: 50%; width: 16px; height: 16px; animation: spin 0.8s linear infinite;
}
```

## 2. Editor Custom CSS (from _editor.css)

### Search Highlight
```css
.search-highlight { background: #ffff00; color: #000; }
.search-highlight-active { background: #ffa500; color: #000; }
```

### WikiLink Hover
```css
a.wikilink { color: rgb(var(--primary)); text-decoration: underline; text-decoration-style: dotted; }
a.wikilink:hover { text-decoration-style: solid; }
```

## 3. Chat Panel Patterns (from _chat.css)

```css
.chat-user { background: rgb(var(--primary) / 0.2); color: rgb(var(--fg)); border-radius: 8px 8px 0 8px; padding: 8px 12px; }
.chat-ai { background: rgb(var(--card)); color: rgb(var(--fg)); border-radius: 8px 8px 8px 0; padding: 8px 12px; border: 1px solid rgb(var(--border)); }
.chat-tool-status { font-size: 11px; color: rgb(var(--muted-fg)); font-style: italic; }
```

## 4. Scrollbar Styling (from _layout.css)

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgb(var(--border)); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgb(var(--muted-fg