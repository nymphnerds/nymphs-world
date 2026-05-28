# WORBI UI — Component Patterns

Use this skill when **building UI components in WORBI**. This covers buttons, inputs, panels, modals, dropdowns, tags, and more.

---

## 1. Buttons

### Primary Button
```tsx
px-3.5 py-2 text-xs font-medium bg-primary text-primary-fg rounded-md cursor-pointer transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed
```

### Secondary Button
```tsx
px-3.5 py-2 text-xs font-medium bg-transparent text-foreground border border-border rounded-md cursor-pointer transition-all hover:bg-muted
```

### Icon / Toolbar Button
```tsx
p-0.5 rounded hover:bg-accent transition-colors text-gray-400 hover:text-white
// Active: bg-primary/30 text-primary p-0.5 rounded transition-colors
// Disabled: opacity-30 cursor-not-allowed
```

### Small Action Button
```tsx
px-2 py-1 text-[10px] rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors
```

### Danger Button
```tsx
px-3 py-1.5 text-xs font-medium bg-destructive/20 hover:bg-destructive/40 text-red-400 hover:text-red-300 rounded-md transition-colors
```

## 2. Input Fields

### Standard Input
```tsx
w-full rounded-md bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary
```

## 3. Panels / Cards

### Card Panel
```tsx
bg-card rounded-lg border border-border
```

### Semi-transparent Panel
```tsx
bg-card/80 backdrop-blur-sm rounded-lg border border-border
```

### Sidebar Panel
```tsx
bg-[#1a1a2e] border-r border-[#3a3a4a]
```

## 4. Tabs

### Tab Bar Background
```tsx
bg-[#1a1a2e] border-b border-[#3a3a4a]
```

### Active Tab
```tsx
bg-primary/20 text-white border-b-2 border-primary
```

### Inactive Tab
```tsx
text-muted-foreground hover:text-foreground hover:bg-accent/50
```

## 5. Activity Bar Icons

```tsx
// Container
w-[48px] bg-[#1a1a2e] border-r border-[#3a3a4a]

// Inactive icon
text-muted-foreground hover:text-foreground hover:bg-accent p-2.5 rounded

// Active icon
text-primary bg-primary/10 p-2.5 rounded border-l-2 border-primary
```

## 6. Modals / Dialogs

### Modal Overlay
```tsx
<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
```

### Modal Content
```tsx
<div className="bg-card border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-[90vw] max-h-[85vh] min-w-[400px] flex flex-col">
```

### Modal Header
```tsx
flex justify-between items-center p-3 border-b border-border font-semibold text-sm
```

### Modal Body
```tsx
p-4 overflow-y-auto flex-1
```

### Modal Footer
```tsx
p-3 border-t border-border flex justify-end gap-2
```

## 7. Dropdown Menus

```tsx
// Menu container
absolute z-50 mt-1 bg-card border border-border rounded-md shadow-lg py-1 min-w-[180px]

// Item
px-3 py-1.5 text-sm text-foreground hover:bg-accent cursor-pointer transition-colors

// Danger item
text-red-400 hover:bg-destructive/20
```

## 8. Tags / Badges

```tsx
// Pill badge
inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--tag-color)]/15 text-[var(--tag-color)] border border-[var(--tag-color)]/30
```

## 9. Toggle Switches

```tsx
// Container
w-10 h-5 rounded-full transition-colors cursor-pointer

// ON: bg-primary, OFF: bg-border

// Knob
w-4 h-4 bg-white rounded-full transition-transform

// ON: translate-x-5, OFF: translate-x-0
```

## 10. States

| State | Tailwind |
|-------|----------|
| Loading | `animate-pulse` |
| Empty | `text-muted-foreground` |
| Error | `bg-destructive/20 text-red-400` |
| Disabled | `opacity-40 cursor-not-allowed` |
| Active | `bg-primary/20 text-primary border-l-2 border-primary` |
| Hover | `hover:bg-accent transition-colors` |
| Focus | `focus:outline-none focus:ring-1 focus:ring-primary` |
| Dirty | `.save-btn-pulse` |
| Starred | `text-amber-400` |