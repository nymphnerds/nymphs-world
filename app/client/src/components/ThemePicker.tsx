import { Palette, Sun, Moon, RotateCcw } from 'lucide-react';
import { useTheme, THEME_PRESETS } from '../hooks/useTheme';
import type { ThemeColours } from '../hooks/useTheme';

interface ColourPickerRowProps {
  label: string;
  keyName: keyof ThemeColours;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function ColourPickerRow({ label, keyName, value, onChange, disabled = false }: ColourPickerRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <label className={`text-xs text-[var(--fg-hex)] ${disabled ? 'opacity-60' : ''}`}>{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--muted-fg-hex)] font-mono">{value}</span>
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-8 h-8 rounded cursor-pointer border border-[var(--border-hex)] bg-transparent disabled:opacity-40 disabled:cursor-not-allowed"
            title={disabled ? 'Disabled for system theme' : label}
          />
        </div>
        <div
          className="w-4 h-4 rounded-full border border-[var(--border-hex)]"
          style={{ backgroundColor: value }}
        />
      </div>
    </div>
  );
}

export function ThemePicker() {
  const { mode, preset, colours, setMode, setPreset, setColour, resetToDefault } = useTheme();

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Theme Presets */}
      <div>
        <label className="block text-xs font-medium mb-3 text-[var(--fg-hex)] uppercase tracking-wider flex items-center gap-2">
          <Palette size={14} /> Theme Presets
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {THEME_PRESETS.map((p) => {
            const isActive = preset === p.id;
            const previewColour = mode === 'light' && p.light ? p.light.primary : p.dark.primary;
            return (
               <button
                 key={p.id}
                 onClick={() => setPreset(p.id)}
                 className={`relative p-3 rounded-lg border-2 transition-all text-center ${
                   isActive
                     ? 'border-[var(--primary-hex)] bg-[var(--primary-hex)]/10'
                     : 'border-[var(--border-hex)] hover:border-[var(--muted-fg-hex)] bg-[var(--card-hex)]'
                 }`}
               >
                 <div className="text-2xl mb-1">{p.emoji}</div>
                 <div className="text-xs font-medium text-[var(--fg-hex)]">{p.name}</div>
                 <div className="flex justify-center gap-0.5 mt-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: previewColour }}
                  />
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: mode === 'light' && p.light ? p.light.background : p.dark.background }}
                  />
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: mode === 'light' && p.light ? p.light.foreground : p.dark.foreground }}
                  />
                </div>
                {p.light && (
                  <div className="text-[10px] text-[var(--muted-fg-hex)] mt-1.5">+ light mode</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Light/Dark Toggle */}
      <div className="flex items-center justify-between py-3 border-t border-[var(--border-hex)]">
        <div>
          <p className="text-xs font-medium text-[var(--fg-hex)]">Theme Mode</p>
          <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Switch between dark and light themes</p>
        </div>
        <div className="flex items-center gap-2">
          <Moon size={16} className={mode === 'dark' ? 'text-[var(--primary-hex)]' : 'text-[var(--muted-fg-hex)]'} />
          <button
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              mode === 'light' ? 'bg-[var(--primary-hex)]' : 'bg-[var(--border-hex)]'
            }`}
            title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform shadow ${
                mode === 'light' ? 'translate-x-7' : 'translate-x-0.5'
              }`}
            />
          </button>
          <Sun size={16} className={mode === 'light' ? 'text-[var(--primary-hex)]' : 'text-[var(--muted-fg-hex)]'} />
          <span className="text-xs text-[var(--muted-fg-hex)] ml-1 capitalize">{mode}</span>
        </div>
      </div>

      {/* Custom Colours */}
      <div className="border-t border-[var(--border-hex)] pt-4">
        <label className="block text-xs font-medium mb-3 text-[var(--fg-hex)] uppercase tracking-wider">
          Custom Colours
        </label>
        <p className="text-[11px] text-[var(--muted-fg-hex)] mb-4">
          Fine-tune individual colours. Changes are saved automatically.
        </p>

        {/* Structure */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-[var(--muted-fg-hex)] uppercase tracking-wider mb-2">Structure</p>
          <div className="bg-[var(--card-hex)] rounded-lg p-3 space-y-1">
            <ColourPickerRow label="Background" keyName="background" value={colours.background} onChange={(v) => setColour('background', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Text" keyName="foreground" value={colours.foreground} onChange={(v) => setColour('foreground', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Panels" keyName="card" value={colours.card} onChange={(v) => setColour('card', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Panel Text" keyName="cardForeground" value={colours.cardForeground} onChange={(v) => setColour('cardForeground', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Borders" keyName="border" value={colours.border} onChange={(v) => setColour('border', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Input BG" keyName="input" value={colours.input} onChange={(v) => setColour('input', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Muted BG" keyName="muted" value={colours.muted} onChange={(v) => setColour('muted', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Muted Text" keyName="mutedForeground" value={colours.mutedForeground} onChange={(v) => setColour('mutedForeground', v)} disabled={preset === 'system'} />
          </div>
        </div>

        {/* Sidebars */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-[var(--muted-fg-hex)] uppercase tracking-wider mb-2">Sidebars</p>
          <div className="bg-[var(--card-hex)] rounded-lg p-3 space-y-1">
            <ColourPickerRow label="Left Sidebar BG" keyName="leftSidebar" value={colours.leftSidebar} onChange={(v) => setColour('leftSidebar', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Right Sidebar BG" keyName="rightSidebar" value={colours.rightSidebar} onChange={(v) => setColour('rightSidebar', v)} disabled={preset === 'system'} />
          </div>
        </div>

        {/* Accent */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-[var(--muted-fg-hex)] uppercase tracking-wider mb-2">Accent</p>
          <div className="bg-[var(--card-hex)] rounded-lg p-3 space-y-1">
            <ColourPickerRow label="Primary" keyName="primary" value={colours.primary} onChange={(v) => setColour('primary', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Primary Text" keyName="primaryForeground" value={colours.primaryForeground} onChange={(v) => setColour('primaryForeground', v)} disabled={preset === 'system'} />
          </div>
        </div>

        {/* Status */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-[var(--muted-fg-hex)] uppercase tracking-wider mb-2">Status</p>
          <div className="bg-[var(--card-hex)] rounded-lg p-3 space-y-1">
            <ColourPickerRow label="Danger" keyName="destructive" value={colours.destructive} onChange={(v) => setColour('destructive', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Success" keyName="success" value={colours.success} onChange={(v) => setColour('success', v)} disabled={preset === 'system'} />
            <ColourPickerRow label="Warning" keyName="warning" value={colours.warning} onChange={(v) => setColour('warning', v)} disabled={preset === 'system'} />
          </div>
        </div>

        {/* Preview */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-[var(--muted-fg-hex)] uppercase tracking-wider mb-2">Preview</p>
          <div className="bg-[var(--card-hex)] rounded-lg p-3 border border-[var(--border-hex)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colours.destructive }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colours.warning }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colours.success }} />
            </div>
            <div className="flex gap-2 mb-2">
              <div className="px-3 py-1 rounded text-xs text-white" style={{ backgroundColor: colours.primary }}>
                <span style={{ color: colours.primaryForeground }}>Accent Button</span>
              </div>
              <div className="px-3 py-1 rounded text-xs border" style={{ borderColor: colours.border, color: colours.foreground }}>
                Secondary
              </div>
            </div>
            <div className="text-xs rounded p-2" style={{ backgroundColor: colours.input, color: colours.foreground }}>
              Input field example text
            </div>
          </div>
        </div>

        {/* Reset */}
        <div className="flex justify-end pt-2">
          <button
            onClick={resetToDefault}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-md bg-[var(--muted-hex)] text-[var(--fg-hex)] hover:bg-[var(--border-hex)] transition-colors"
          >
            <RotateCcw size={13} /> Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
}