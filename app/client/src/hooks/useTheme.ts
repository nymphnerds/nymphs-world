import { useState, useCallback, useEffect } from 'react';

// === Theme Colour Map ===

export type ThemeMode = 'dark' | 'light';

export interface ThemeColours {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  input: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  destructive: string;
  success: string;
  warning: string;
  leftSidebar: string;
  rightSidebar: string;
}

export interface ThemeSettings {
  mode: ThemeMode;
  preset: string;
  colours: ThemeColours;
}

// === Utility ===

/**
 * Darken a hex color by the given amount (0-1), clamped to 0.
 */
function darkenColor(hex: string, amount: number): string {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return hex;
  const r = Math.max(0, Math.floor(parseInt(match[1], 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(parseInt(match[2], 16) * (1 - amount)));
  const b = Math.max(0, Math.floor(parseInt(match[3], 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// === Presets ===

const PURPLE_MIST: ThemeColours = {
  background: '#1e1e2e',
  foreground: '#e0e0e0',
  card: '#262636',
  cardForeground: '#e0e0e0',
  border: '#3a3a4a',
  input: '#2a2a3a',
  primary: '#a78bfa',
  primaryForeground: '#1a1a2e',
  muted: '#2a2a3a',
  mutedForeground: '#888888',
  destructive: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  leftSidebar: darkenColor('#262636', 0.12),
  rightSidebar: darkenColor('#262636', 0.12),
};

const NORD: ThemeColours = {
  background: '#2e3440',
  foreground: '#d8dee9',
  card: '#3b4252',
  cardForeground: '#d8dee9',
  border: '#4c566a',
  input: '#434c5e',
  primary: '#5e8899',
  primaryForeground: '#eceff4',
  muted: '#434c5e',
  mutedForeground: '#7b88a1',
  destructive: '#bf616a',
  success: '#a3be8c',
  warning: '#ebcb8b',
  leftSidebar: darkenColor('#3b4252', 0.12),
  rightSidebar: darkenColor('#3b4252', 0.12),
};

const GRUVBOX: ThemeColours = {
  background: '#282828',
  foreground: '#ebdbb2',
  card: '#3c3836',
  cardForeground: '#ebdbb2',
  border: '#504945',
  input: '#3c3836',
  primary: '#fabd2f',
  primaryForeground: '#282828',
  muted: '#3c3836',
  mutedForeground: '#928374',
  destructive: '#fb4934',
  success: '#b8bb26',
  warning: '#fabd2f',
  leftSidebar: darkenColor('#3c3836', 0.12),
  rightSidebar: darkenColor('#3c3836', 0.12),
};

const NYMPHS: ThemeColours = {
  background: '#1e2e1e',
  foreground: '#e8f0e8',
  card: '#2a3a2a',
  cardForeground: '#e8f0e8',
  border: '#3a4a3a',
  input: '#2a3a2a',
  primary: '#66bb6a',
  primaryForeground: '#1a2e1a',
  muted: '#2a3a2a',
  mutedForeground: '#6a8a6a',
  destructive: '#ef5350',
  success: '#4caf50',
  warning: '#c8c84a',
  leftSidebar: darkenColor('#2a3a2a', 0.12),
  rightSidebar: darkenColor('#2a3a2a', 0.12),
};

const OCEAN: ThemeColours = {
  background: '#161b24',
  foreground: '#c9d1d9',
  card: '#1e2530',
  cardForeground: '#c9d1d9',
  border: '#2d3a4a',
  input: '#222b38',
  primary: '#56b6c2',
  primaryForeground: '#161b24',
  muted: '#222b38',
  mutedForeground: '#6a7a8a',
  destructive: '#e06c75',
  success: '#98c379',
  warning: '#e5c07b',
  leftSidebar: darkenColor('#1e2530', 0.12),
  rightSidebar: darkenColor('#1e2530', 0.12),
};

// CSS System Colors — follow the user's OS theme (Windows/macOS/Linux)
// https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#system_colors
const SYSTEM: ThemeColours = {
  background: 'Canvas',
  foreground: 'CanvasText',
  card: 'ButtonFace',
  cardForeground: 'ButtonText',
  border: 'GrayText',
  input: 'ButtonFace',
  primary: 'Highlight',
  primaryForeground: 'HighlightText',
  muted: 'Canvas',
  mutedForeground: 'GrayText',
  destructive: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  leftSidebar: 'ButtonFace',
  rightSidebar: 'ButtonFace',
};

// Light mode variants
const PURPLE_MIST_LIGHT: ThemeColours = {
  background: '#f5f5f7',
  foreground: '#1e1e2e',
  card: '#ffffff',
  cardForeground: '#1e1e2e',
  border: '#d4d4d8',
  input: '#e8e8ec',
  primary: '#7c5acf',
  primaryForeground: '#ffffff',
  muted: '#e8e8ec',
  mutedForeground: '#6b6b7b',
  destructive: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  leftSidebar: darkenColor('#ffffff', 0.12),
  rightSidebar: darkenColor('#ffffff', 0.12),
};

const NORD_LIGHT: ThemeColours = {
  background: '#eceff4',
  foreground: '#2e3440',
  card: '#e5e9f0',
  cardForeground: '#2e3440',
  border: '#d8dee9',
  input: '#d8dee9',
  primary: '#4a7a8c',
  primaryForeground: '#ffffff',
  muted: '#d8dee9',
  mutedForeground: '#6b7888',
  destructive: '#bf616a',
  success: '#7da87b',
  warning: '#b8a050',
  leftSidebar: darkenColor('#e5e9f0', 0.12),
  rightSidebar: darkenColor('#e5e9f0', 0.12),
};

const OCEAN_LIGHT: ThemeColours = {
  background: '#f0f4f8',
  foreground: '#1a2332',
  card: '#ffffff',
  cardForeground: '#1a2332',
  border: '#c8d6e5',
  input: '#e2e8f0',
  primary: '#3a94a8',
  primaryForeground: '#ffffff',
  muted: '#e2e8f0',
  mutedForeground: '#5a6a7a',
  destructive: '#c0525a',
  success: '#6a9a5a',
  warning: '#c49a3a',
  leftSidebar: darkenColor('#ffffff', 0.12),
  rightSidebar: darkenColor('#ffffff', 0.12),
};

export interface ThemePresetDef {
  id: string;
  name: string;
  emoji: string;
  dark: ThemeColours;
  light?: ThemeColours;
}

export const THEME_PRESETS: ThemePresetDef[] = [
  { id: 'purple-mist', name: 'Purple Mist', emoji: '💜', dark: PURPLE_MIST, light: PURPLE_MIST_LIGHT },
  { id: 'nord', name: 'Nord', emoji: '🔵', dark: NORD, light: NORD_LIGHT },
  { id: 'gruvbox', name: 'Gruvbox', emoji: '🟡', dark: GRUVBOX },
  { id: 'nymphs', name: 'Nymphs', emoji: '🌿', dark: NYMPHS },
  { id: 'ocean', name: 'Ocean', emoji: '🌊', dark: OCEAN, light: OCEAN_LIGHT },
  { id: 'system', name: 'System', emoji: '🖥️', dark: SYSTEM },
];

const STORAGE_KEY = 'wbu_theme_settings';

// Default settings
const defaultSettings = (): ThemeSettings => ({
  mode: 'dark',
  preset: 'purple-mist',
  colours: { ...PURPLE_MIST },
});

function loadSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate structure
      if (parsed.mode && parsed.preset && parsed.colours) {
        // Ensure all colour keys exist (for forward/backward compatibility)
        const defaults = defaultSettings();
        return {
          mode: parsed.mode === 'light' ? 'light' : 'dark',
          preset: parsed.preset,
          colours: {
            background: parsed.colours.background ?? defaults.colours.background,
            foreground: parsed.colours.foreground ?? defaults.colours.foreground,
            card: parsed.colours.card ?? defaults.colours.card,
            cardForeground: parsed.colours.cardForeground ?? defaults.colours.cardForeground,
            border: parsed.colours.border ?? defaults.colours.border,
            input: parsed.colours.input ?? defaults.colours.input,
            primary: parsed.colours.primary ?? defaults.colours.primary,
            primaryForeground: parsed.colours.primaryForeground ?? defaults.colours.primaryForeground,
            muted: parsed.colours.muted ?? defaults.colours.muted,
            mutedForeground: parsed.colours.mutedForeground ?? defaults.colours.mutedForeground,
            destructive: parsed.colours.destructive ?? defaults.colours.destructive,
            success: parsed.colours.success ?? defaults.colours.success,
            warning: parsed.colours.warning ?? defaults.colours.warning,
            leftSidebar: parsed.colours.leftSidebar ?? defaults.colours.leftSidebar,
            rightSidebar: parsed.colours.rightSidebar ?? defaults.colours.rightSidebar,
          },
        };
      }
    }
  } catch {
    // ignore
  }
  return defaultSettings();
}

function saveSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

// Mapping from camelCase colour keys to CSS variable names
const CSS_VAR_MAP: Record<keyof ThemeColours, string> = {
  background: '--bg',
  foreground: '--fg',
  card: '--card',
  cardForeground: '--card-fg',
  border: '--border',
  input: '--input',
  primary: '--primary',
  primaryForeground: '--primary-fg',
  muted: '--muted',
  mutedForeground: '--muted-fg',
  destructive: '--destructive',
  success: '--success',
  warning: '--warning',
  leftSidebar: '--left-sidebar',
  rightSidebar: '--right-sidebar',
};

/**
 * Apply theme colours to the document root as CSS custom properties.
 */
export function applyThemeColours(colours: ThemeColours, mode: ThemeMode): void {
  const root = document.documentElement;

  // Set data-theme attribute for mode-specific styles
  root.setAttribute('data-theme', mode);

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const hex = colours[key as keyof ThemeColours];
    if (hex) {
      // Convert hex to RGB for use in CSS var
      const rgb = hexToRgb(hex);
      if (rgb) {
        root.style.setProperty(cssVar, rgb);
        root.style.setProperty(`${cssVar}-hex`, hex);
      }
    }
  }
}

/** CSS system color keywords that should be passed through directly */
const SYSTEM_COLOR_KEYWORDS = new Set([
  'Canvas', 'CanvasText', 'ButtonFace', 'ButtonText',
  'GrayText', 'Highlight', 'HighlightText', 'Mark',
]);

function hexToRgb(hex: string): string | null {
  // Pass through CSS system color keywords as-is
  if (SYSTEM_COLOR_KEYWORDS.has(hex)) return hex;
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const r = parseInt(match[1].substring(0, 2), 16);
  const g = parseInt(match[1].substring(2, 4), 16);
  const b = parseInt(match[1].substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/**
 * Get the preset colour map for a given preset ID and mode.
 */
export function getPresetColours(presetId: string, mode: ThemeMode): ThemeColours | null {
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  if (mode === 'light' && preset.light) return preset.light;
  return preset.dark;
}

// === React Hook ===

export function useTheme() {
  const [settings, setSettings] = useState<ThemeSettings>(loadSettings);

  // Apply theme on mount
  useEffect(() => {
    applyThemeColours(settings.colours, settings.mode);
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setSettings((prev) => {
      // When switching mode, if the preset has a light variant, use it; otherwise keep current colours
      const newSettings: ThemeSettings = { ...prev, mode };
      const preset = THEME_PRESETS.find((p) => p.id === prev.preset);
      if (preset) {
        if (mode === 'light' && preset.light) {
          newSettings.colours = { ...preset.light };
        } else if (mode === 'dark') {
          newSettings.colours = { ...preset.dark };
        }
      }
      // If no light variant for this preset and user switched to light, keep colours but update mode
      applyThemeColours(newSettings.colours, newSettings.mode);
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const setPreset = useCallback((presetId: string) => {
    setSettings((prev) => {
      const colours = getPresetColours(presetId, prev.mode);
      if (!colours) return prev;
      const newSettings: ThemeSettings = {
        ...prev,
        preset: presetId,
        colours: { ...colours },
      };
      applyThemeColours(newSettings.colours, newSettings.mode);
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const setColour = useCallback((key: keyof ThemeColours, value: string) => {
    setSettings((prev) => {
      const newSettings: ThemeSettings = {
        ...prev,
        colours: { ...prev.colours, [key]: value },
      };
      applyThemeColours(newSettings.colours, newSettings.mode);
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const resetToDefault = useCallback(() => {
    const defaults = defaultSettings();
    applyThemeColours(defaults.colours, defaults.mode);
    saveSettings(defaults);
    setSettings(defaults);
  }, []);

  return {
    settings,
    mode: settings.mode,
    preset: settings.preset,
    colours: settings.colours,
    setMode,
    setPreset,
    setColour,
    resetToDefault,
  };
}