# WORBI UI — Colors & Themes

## CSS Custom Properties

All colors use HSL values stored as CSS custom properties. `--bg`, `--fg`, etc. store RGB triplets for use with `rgb(var(--var) / alpha)` syntax.

### Default Theme: Purple Mist

| Variable | RGB Value | Hex | Alpha Usage | Description |
|----------|-----------|-----|-------------|-------------|
| `--bg` | `30 30 46` | `#1e1e2e` | `rgb(var(--bg) / 0.8)` | Page background |
| `--card` | `38 38 54` | `#262636` | `rgb(var(--card) / 0.8)` | Card/panel background |
| `--card-fg` | `224 224 224` | `#e0e0e0` | — | Text on card |
| `--border` | `58 58 74` | `#3a3a4a` | `rgb(var(--border) / 0.5)` | Borders, dividers |
| `--input` | `42 42 58` | `#2a2a3a` | — | Input background |
| `--primary` | `167 139 250` | `#a78bfa` | `rgb(var(--primary) / 0.2)` | Active states |
| `--primary-fg` | `26 26 46` | `#1a1a2e` | — | Text on primary |
| `--muted` | `42 42 58` | `#2a2a3a` | — | Muted surfaces |
| `--muted-fg` | `136 136 136` | `#888` | — | Secondary text |
| `--destructive` | `239 68 68` | `#ef4444` | — | Delete, error |
| `--success` | `34 197 94` | `#22c55e` | — | Online, saved |
| `--warning` | `245 158 11` | `#f59e0b` | — | Warnings |
| `--ring` | `167 139 250` | `#a78bfa` | — | Focus ring |
| `--radius` | — | `0.5rem` | — | Border radius |

### Theme Presets

| Preset | ID | Primary | Background | Notes |
|--------|----|---------|------------|-------|
| Purple Mist | `purple-mist` | `#a78bfa` | `#1e1e2e` | Default, + light mode |
| Nord | `nord` | `#5e8899` | `#2e3440` | Cool blue-gray, + light mode |
| Gruvbox | `gruvbox` | `#fabd2f` | `#282828` | Warm retro |
| Nymphs | `nymphs` | `#66bb6a` | `#1e2e1e` | Green theme, dark only |
| Ocean | `ocean` | `#56b6c2` | `#161b24` | Teal-blue, + light mode |
| System | `system` | OS-level | OS-level | Auto OS dark mode, CSS-only |

**System Theme**: Uses CSS `color-mix()` and `@media (prefers-color-scheme: dark)` — no hardcoded hex values. Color pickers are automatically disabled when System theme is active.

**Nymphs Theme**: `background: #1e2e1e`, `card: #2a3a2a`, `border: #3a4a3a`, `primary: #66bb6a`. Dark mode only.

## Semantic Color Tokens

| Semantic Token | CSS Variable | Usage |
|---------------|-------------|-------|
| `bg-background` | `rgb(var(--bg))` | Page root |
| `bg-card` | `rgb(var(--card))` | Panels, cards, dropdowns |
| `bg-input` | `rgb(var(--input))` | Inputs, textareas |
| `border-border` | `rgb(var(--border))` | All borders |
| `text-foreground` | `rgb(var(--fg))` | Body text |
| `text-muted-foreground` | `rgb(var(--muted-fg))` | Hints, placeholders |
| `bg-primary` | `rgb(var(--primary))` | Active states |
| `text-primary` | `rgb(var(--primary))` | Accent text |
| `bg-destructive` | `rgb(var(--destructive))` | Delete, error |
| `bg-accent` | `rgb(var(--muted))` | Hover states |

## Alpha Blending Pattern

For semi-transparent surfaces, use CSS variable alpha syntax:
```css
background: rgb(var(--card) / 0.8);  /* 80% opaque card */
background: rgb(var(--primary) / 0.2); /* 20% primary tint */
```

In Tailwind, use `/` notation:
```tsx
bg-primary/20   /* 20% primary — active icon tint */
bg-primary/30   /* 30% primary — active toolbar button */
bg-black/50     /* 50% black — overlay backdrop */
bg-card/80      /* 80% card — semi-transparent panel */
```

## Border Radius & Shadows

### Border Radius

| Radius | Value | Tailwind | Usage |
|--------|-------|----------|-------|
| Small | 4px | `rounded` | Icons, small buttons |
| Default | 8px | `rounded-md` | Buttons, inputs, cards |
| Large | 12px | `rounded-lg` | Modals, panels |
| Full | 9999px | `rounded-full` | Tags, avatars, toggle knobs |

### Shadows

| Shadow | CSS | Usage |
|--------|-----|-------|
| Modal | `0 8px 32px rgba(0,0,0,0.5)` | `.modal-content` |
| Dropdown | `0 4px 12px rgba(0,0,0,0.3)` | `.dropdown-menu` |