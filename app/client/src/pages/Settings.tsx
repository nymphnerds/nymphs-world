import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { X, Check, AlertCircle, Settings as SettingsIcon, Zap, Shield, RefreshCw, Eye, EyeOff, Sparkles, Palette, Tags, MapPin, Clock, ListTree, GitGraph, Image as ImageIcon, Bell, LayoutPanelLeft, Wrench, MessageSquare } from 'lucide-react';
import { useLLM } from '../hooks/useLLM';
import { getMaxTabs, setMaxTabs } from '../hooks/useFiles';
import { ThemePicker } from '../components/ThemePicker';
import { useAuthContext } from '../features/auth/AuthProvider';
import type { ToolPermissions, ImageGenStatus as ImageGenStatusType } from '../services/api';
import { getImageGenerationStatus, testZImageConnection, saveUserSettings } from '../services/api';

// Static provider presets for manual selection

const PROVIDER_PRESETS = [
  // Local providers
  { id: 'lm-studio', name: 'LM Studio', group: 'local', defaultUrl: 'http://localhost:1234/v1', requiresApiKey: false },
  { id: 'ollama', name: 'Ollama', group: 'local', defaultUrl: 'http://localhost:11434/v1', requiresApiKey: false },
  { id: 'llama-cpp', name: 'llama.cpp', group: 'local', defaultUrl: 'http://localhost:8080/v1', requiresApiKey: false },
  { id: 'textgen-webui', name: 'TextGen WebUI', group: 'local', defaultUrl: 'http://localhost:5000/v1', requiresApiKey: false },
  { id: 'localai', name: 'LocalAI', group: 'local', defaultUrl: 'http://localhost:8080/v1', requiresApiKey: false },
  { id: 'jan', name: 'Jan', group: 'local', defaultUrl: 'http://localhost:1337/v1', requiresApiKey: false },
  { id: 'vllm', name: 'vLLM', group: 'local', defaultUrl: 'http://localhost:8000/v1', requiresApiKey: false },
  // Cloud providers
  { id: 'openai', name: 'OpenAI', group: 'cloud', defaultUrl: 'https://api.openai.com/v1', requiresApiKey: true },
  { id: 'groq', name: 'Groq', group: 'cloud', defaultUrl: 'https://api.groq.com/openai/v1', requiresApiKey: true },
  { id: 'together', name: 'Together AI', group: 'cloud', defaultUrl: 'https://api.together.xyz/v1', requiresApiKey: true },
  { id: 'openrouter', name: 'OpenRouter', group: 'cloud', defaultUrl: 'https://openrouter.ai/api/v1', requiresApiKey: true },
  { id: 'mistral', name: 'Mistral', group: 'cloud', defaultUrl: 'https://api.mistral.ai/v1', requiresApiKey: true },
  { id: 'anthropic', name: 'Anthropic', group: 'cloud', defaultUrl: 'https://api.anthropic.com/v1', requiresApiKey: true, warning: 'Anthropic uses a non-OpenAI-compatible API. Model loading and chat may not work without a custom adapter.' },
  { id: 'xai', name: 'xAI (Grok)', group: 'cloud', defaultUrl: 'https://api.x.ai/v1', requiresApiKey: true },
  { id: 'google', name: 'Google AI Studio', group: 'cloud', defaultUrl: 'https://generativelanguage.googleapis.com/v1', requiresApiKey: true, warning: 'Google AI Studio uses a non-OpenAI-compatible API. Model loading and chat may not work without a custom adapter.' },
  // Custom
  { id: 'custom', name: 'Custom (any OpenAI-compatible server)', group: 'other', defaultUrl: '', requiresApiKey: false },
];

type SettingsTab = 'llm' | 'tools' | 'images' | 'editor' | 'appearance';

interface SettingsProps {
  onClose: () => void;
  onOpenMaintenance?: () => void;
}

const inputClass = 'w-full rounded-md bg-[var(--card-hex)] px-3 py-2 text-sm text-[var(--fg-hex)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-hex)]';

const selectClass = `${inputClass} appearance-none cursor-pointer`;

// Connection status helpers
const statusColor = (status: string): string => {
  switch (status) {
    case 'connected': return 'text-green-400';
    case 'reachable-no-models': return 'text-yellow-400';
    case 'failed': return 'text-red-400';
    case 'testing': return 'text-[#888]';
    default: return 'text-[#666]';
  }
};

const statusText = (status: string, modelName: string): string => {
  switch (status) {
    case 'connected': return modelName ? `Connected — ${modelName}` : 'Connected';
    case 'reachable-no-models': return 'Server reachable but no models';
    case 'failed': return 'Connection failed';
    case 'testing': return 'Testing connection...';
    default: return 'Not tested';
  }
};

const dotClass = (status: string): string => {
  switch (status) {
    case 'connected': return 'bg-green-400';
    case 'reachable-no-models': return 'bg-yellow-400';
    case 'failed': return 'bg-red-400';
    case 'testing': return 'bg-[#888] animate-pulse';
    default: return 'bg-[#444]';
  }
};

export function Settings({ onClose, onOpenMaintenance }: SettingsProps) {
  const {
    settings,
    loading,
    error,
    models,
    testing,
    updateSettings,
    saveUserSettings,
    testConn,
    loadModels,
    toolPermissions,
    updateToolPermissions,
    saveToolPermissions,
    connectionStatus,
  } = useLLM();
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState<SettingsTab>('llm');
  const [saved, setSaved] = useState(false);
  const [maxTabs, setMaxTabsState] = useState(getMaxTabs());
  const [showApiKey, setShowApiKey] = useState(false);

  // Sidebar visibility settings
  const SIDEBAR_ICONS = [
    { key: 'tags' as const, label: 'Tags', icon: Tags },
    { key: 'locations' as const, label: 'Locations', icon: MapPin },
    { key: 'timeline' as const, label: 'Timeline', icon: Clock },
    { key: 'dialogue' as const, label: 'Dialogue', icon: MessageSquare },
    { key: 'outline' as const, label: 'Outline', icon: ListTree },
    { key: 'graph' as const, label: 'Relationship Graph', icon: GitGraph },
    { key: 'images' as const, label: 'Image Generator', icon: ImageIcon },
    { key: 'reminders' as const, label: 'Reminders', icon: Bell },
    { key: 'ai' as const, label: 'AI Panel', icon: Sparkles },
  ];

  const DEFAULT_VISIBILITY: Record<string, boolean> = {
    tags: false, locations: false, timeline: false, dialogue: false, outline: false,
    graph: false, images: false, reminders: false, ai: false,
  };

  // Reactive sidebar visibility: re-read from localStorage whenever user changes or toggle fires.
  // Uses user?.username (string) as dependency for reliable re-computation on login/logout.
  // NO global fallback key — only user-scoped keys to prevent cross-user data leakage.
  const [visibilityRefreshKey, setVisibilityRefreshKey] = useState(0);
  useEffect(() => {
    setVisibilityRefreshKey(k => k + 1);
  }, [user?.username]);

  const sidebarVisibility = useMemo(() => {
    void visibilityRefreshKey;
    // If no user, return defaults (all hidden) — do NOT fall back to global key
    if (!user?.username) return { ...DEFAULT_VISIBILITY };
    const visKey = `wbu_${user.username}_sidebar_visibility`;
    try {
      const stored = localStorage.getItem(visKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_VISIBILITY, ...parsed };
      }
    } catch { /* ignore */ }
    return { ...DEFAULT_VISIBILITY };
  }, [user?.username, visibilityRefreshKey]);

  const handleToggleVisibility = useCallback((key: string) => {
    // If no user, skip — do NOT write to global key
    if (!user?.username) return;
    const visKey = `wbu_${user.username}_sidebar_visibility`;
    try {
      const stored = localStorage.getItem(visKey);
      const current: Record<string, boolean> = stored ? { ...DEFAULT_VISIBILITY, ...JSON.parse(stored) } : { ...DEFAULT_VISIBILITY };
      const next = { ...current, [key]: !current[key] };
      localStorage.setItem(visKey, JSON.stringify(next));
    } catch { /* ignore */ }
    setVisibilityRefreshKey(k => k + 1);
    window.dispatchEvent(new Event('wbu-sidebar-visibility-change'));
  }, [user?.username]);

  // Track if maxTokens was auto-adjusted
  const [maxTokensAdjusted, setMaxTokensAdjusted] = useState(false);
  const clearMaxTokensAdjusted = useCallback(() => setMaxTokensAdjusted(false), []);

  // Helper: calculate suggested maxTokens from context window
  const suggestedMaxTokens = (contextWindow: number) => Math.floor(contextWindow * 0.5);

  // UI-only state for form fields (commit to settings on save)
  const [formProviderId, setFormProviderId] = useState(settings.providerId);
  const [formBaseUrl, setFormBaseUrl] = useState(settings.baseUrl);
  const [formApiKey, setFormApiKey] = useState(settings.apiKey);
  const [formModelName, setFormModelName] = useState(settings.modelName);
  const [testError, setTestError] = useState<string | null>(null);
  const initialSyncDone = useRef(false);
  const apiKeySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync form state only on initial load (when settings arrive from server)
  // After first sync, do NOT overwrite — preserves user edits in the form
  // Guard: only sync when settings have actual data (non-empty baseUrl) to avoid
  // consuming the empty default render before the async server response arrives
  useEffect(() => {
    if (!initialSyncDone.current && settings.baseUrl) {
      setFormProviderId(settings.providerId);
      setFormBaseUrl(settings.baseUrl);
      setFormApiKey(settings.apiKey);
      setFormModelName(settings.modelName);
      initialSyncDone.current = true;
    }
  }, [settings.providerId, settings.baseUrl, settings.apiKey, settings.modelName]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (apiKeySaveTimer.current) {
        clearTimeout(apiKeySaveTimer.current);
      }
    };
  }, []);

  // Debounced auto-save when API key changes (1s delay after user stops typing)
  useEffect(() => {
    if (!initialSyncDone.current) return; // Skip until initial sync completes

    // Clear any existing timer
    if (apiKeySaveTimer.current) {
      clearTimeout(apiKeySaveTimer.current);
    }

    // Debounce: wait 1s after last keystroke before saving
    apiKeySaveTimer.current = setTimeout(async () => {
      updateSettings({ apiKey: formApiKey });
      await saveUserSettings({
        ...settings,
        apiKey: formApiKey,
        baseUrl: formBaseUrl,
        providerId: formProviderId,
      });
    }, 1000);
  }, [formApiKey]);

  const handleMaxTabsChange = useCallback((val: number) => {
    const clamped = Math.max(1, Math.min(50, val));
    setMaxTabsState(clamped);
    setMaxTabs(clamped);
  }, []);

  const handleSave = useCallback(async () => {
    // Build merged settings with current form values to avoid stale closure
    const merged = {
      ...settings,
      providerId: formProviderId,
      baseUrl: formBaseUrl,
      apiKey: formApiKey,
      modelName: formModelName,
      serverType: formProviderId === 'ollama' ? 'ollama' : '',
    };
    // Commit form values to settings state
    updateSettings(merged);
    // Pass merged settings directly to avoid stale closure
    await saveUserSettings(merged);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [formProviderId, formBaseUrl, formApiKey, formModelName, settings, updateSettings, saveUserSettings]);

  const handleSavePermissions = useCallback(async () => {
    await saveToolPermissions(toolPermissions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [saveToolPermissions, toolPermissions]);

  const handleProviderChange = useCallback((providerId: string) => {
    setFormProviderId(providerId);

    // Find the provider in presets
    const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
    if (preset && preset.defaultUrl) {
      setFormBaseUrl(preset.defaultUrl);
    } else if (providerId === 'custom') {
      // Keep existing URL for custom
    }
  }, []);

  const handleTestConnection = useCallback(async () => {
    setTestError(null);
    updateSettings({
      providerId: formProviderId,
      baseUrl: formBaseUrl,
      apiKey: formApiKey,
      serverType: formProviderId === 'ollama' ? 'ollama' : '',
    });
    await testConn();
    // After test, load models if success
    if (connectionStatus === 'connected' || formBaseUrl) {
      loadModels(formBaseUrl, formApiKey, formProviderId === 'ollama' ? 'ollama' : '');
    }
  }, [formProviderId, formBaseUrl, formApiKey, testConn, loadModels, connectionStatus, updateSettings]);

  const handleRefreshModels = useCallback(async () => {
    loadModels(formBaseUrl, formApiKey, formProviderId === 'ollama' ? 'ollama' : '');
  }, [formBaseUrl, formApiKey, formProviderId, loadModels]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const toggleRow = "flex items-center justify-between py-3 border-b border-[var(--border-hex)]";

  const maskApiKey = (key: string): string => {
    if (!key) return '';
    if (key.length <= 8) return key.substring(0, 2) + '***';
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
  };

  // Group providers
  const localPresets = PROVIDER_PRESETS.filter((p) => p.group === 'local');
  const cloudPresets = PROVIDER_PRESETS.filter((p) => p.group === 'cloud');
  const otherPresets = PROVIDER_PRESETS.filter((p) => p.group === 'other');

  // Check if selected provider requires API key
  const selectedPreset = PROVIDER_PRESETS.find((p) => p.id === formProviderId);
  const requiresApiKey = selectedPreset?.requiresApiKey || false;
  const providerWarning = selectedPreset?.warning;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-hex)] text-[var(--fg-hex)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-hex)]">
        <h2 className="text-sm font-semibold">Settings</h2>
        <div className="flex items-center gap-1">
          {onOpenMaintenance && (
            <button
              onClick={onOpenMaintenance}
              className="p-1 rounded hover:bg-[var(--card-hex)] transition-colors text-[var(--muted-fg-hex)] hover:text-[var(--fg-hex)]"
              title="Maintenance Tools"
            >
              <Wrench size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--card-hex)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="flex border-b border-[var(--border-hex)] overflow-x-auto scrollbar-thin">
        {([
          { key: 'llm' as SettingsTab, label: 'LLM', icon: SettingsIcon },
          { key: 'tools' as SettingsTab, label: 'Tools', icon: Zap },
          { key: 'images' as SettingsTab, label: 'Images', icon: Sparkles },
          { key: 'editor' as SettingsTab, label: 'Editor', icon: SettingsIcon },
          { key: 'appearance' as SettingsTab, label: 'Appearance', icon: Palette },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === key
                ? 'border-[var(--primary-hex)] text-[var(--fg-hex)]'
                : 'border-transparent text-[var(--muted-fg-hex)] hover:text-[var(--fg-hex)]'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {/* === LLM Tab === */}
        {activeTab === 'llm' && (
          <>
            {(error || testError) && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-red-500/10 text-red-400 text-sm">
                <AlertCircle size={16} />
                {testError || error}
              </div>
            )}

            {providerWarning && (
              <div className="flex items-start gap-2 mb-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p>{providerWarning}</p>
              </div>
            )}

            <div className="space-y-5">
              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">Provider</label>
                <select
                  value={formProviderId}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className={`${selectClass} w-full`}
                >
                  <optgroup label="Local (no API key)">
                    {localPresets.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Cloud (API key required)">
                    {cloudPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.warning ? ' ⚠' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other">
                    {otherPresets.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-[var(--muted-fg-hex)] mt-1">Select a provider to auto-fill the URL below, then configure your connection.</p>
              </div>

              {/* URL — always visible for manual configuration */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">URL</label>
                <input
                  type="text"
                  value={formBaseUrl}
                  onChange={(e) => setFormBaseUrl(e.target.value)}
                  placeholder="http://localhost:1234/v1"
                  className={inputClass}
                />
                <p className="text-[11px] text-[var(--muted-fg-hex)] mt-1">Base URL for the LLM API endpoint.</p>
              </div>

              {/* API Key — always shown (some local servers like llama.cpp also require API keys) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium uppercase tracking-wider">
                    API Key {requiresApiKey ? <span className="text-red-400">*</span> : '(optional)'}
                  </label>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={formApiKey}
                      onChange={(e) => setFormApiKey(e.target.value)}
                      placeholder={requiresApiKey ? 'Enter your API key' : 'Optional — for local servers leave empty'}
                      className={`${inputClass} pr-8`}
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-fg-hex)] hover:text-[var(--fg-hex)]"
                      title={showApiKey ? 'Hide key' : 'Show key'}
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                {formApiKey && formApiKey.length > 4 && (
                  <p className="text-[11px] text-[var(--muted-fg-hex)] mt-1">Masked: {maskApiKey(formApiKey)}</p>
                )}
              </div>

              {/* Model */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium uppercase tracking-wider">Model</label>
                  <button
                    onClick={handleRefreshModels}
                    disabled={loading || !formBaseUrl}
                    className="p-1 rounded text-[var(--muted-fg-hex)] hover:text-[var(--fg-hex)] transition-colors disabled:opacity-50"
                    title="Refresh model list"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
                <select
                  value={formModelName}
                  onChange={async (e) => {
                    const newModel = e.target.value;
                    setFormModelName(newModel);
                    updateSettings({ modelName: newModel });
                    await saveUserSettings({
                      ...settings,
                      modelName: newModel,
                      apiKey: formApiKey,
                      baseUrl: formBaseUrl,
                      providerId: formProviderId,
                    });
                  }}
                  disabled={!formBaseUrl}
                  className={`${selectClass} disabled:opacity-50`}
                >
                  {formModelName && !models.includes(formModelName) && (
                    <option key="saved" value={formModelName}>✓ {formModelName}</option>
                  )}
                  <option value="">-- Select a model --</option>
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {!formBaseUrl && (
                  <p className="text-[11px] text-[var(--muted-fg-hex)] mt-1">Enter a provider URL above to load models.</p>
                )}
                {formBaseUrl && models.length === 0 && !loading && connectionStatus === 'failed' && (
                  <p className="text-[11px] text-yellow-400 mt-1">⚠ Could not load models. Check URL and click Refresh.</p>
                )}
              </div>

              {/* Connection Status */}
              <div>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${dotClass(connectionStatus)}`} />
                  <span className={`text-xs font-medium ${statusColor(connectionStatus)}`}>
                    {statusText(connectionStatus, formModelName)}
                  </span>
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || !formBaseUrl}
                    className="ml-auto px-3 py-1.5 text-xs rounded-md bg-[var(--primary-hex)]/20 text-[var(--primary-hex)] hover:bg-[var(--primary-hex)]/30 transition-colors disabled:opacity-50"
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">Max Tokens</label>
                <input
                  type="number"
                  value={settings.maxTokens}
                  onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) || 4096 })}
                  className={inputClass}
                />
                <p className="text-[11px] text-[var(--muted-fg-hex)] mt-1">Maximum tokens in the LLM response.</p>
              </div>

              {/* Context Window Size */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">
                  Context Window Size: {settings.contextWindow?.toLocaleString() || '8,192'} tokens
                </label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {[4096, 8192, 16384, 32768, 128000].map((v) => (
                    <button
                      key={v}
                      onClick={() => {
                        const suggested = suggestedMaxTokens(v);
                        const newMax = Math.max(256, Math.min(suggested, settings.maxTokens > v ? suggested : settings.maxTokens));
                        if (newMax !== settings.maxTokens) {
                          setMaxTokensAdjusted(true);
                          setTimeout(() => setMaxTokensAdjusted(false), 3000);
                        }
                        updateSettings({ contextWindow: v, maxTokens: newMax });
                      }}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        settings.contextWindow === v
                          ? 'bg-[var(--primary-hex)] text-[var(--primary-fg-hex)]'
                          : 'bg-[var(--card-hex)] text-[var(--muted-fg-hex)] hover:text-[var(--fg-hex)]'
                      }`}
                    >
                      {v >= 1000 ? `${v / 1000}K` : v}
                    </button>
                  ))}
                  <input
                    type="number"
                    value={settings.contextWindow}
                    onChange={(e) => {
                      const cw = parseInt(e.target.value) || 8192;
                      const suggested = suggestedMaxTokens(cw);
                      const newMax = Math.max(256, Math.min(suggested, settings.maxTokens > cw ? suggested : settings.maxTokens));
                      if (newMax !== settings.maxTokens) {
                        setMaxTokensAdjusted(true);
                        setTimeout(() => setMaxTokensAdjusted(false), 3000);
                      }
                      updateSettings({ contextWindow: cw, maxTokens: newMax });
                    }}
                    className={`${inputClass} w-24`}
                    min={1024}
                    step={1}
                  />
                </div>
                {maxTokensAdjusted && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-300 animate-pulse">
                    <Zap size={11} />
                    Max Tokens auto-adjusted to fit context window
                  </div>
                )}
                <p className="text-[11px] text-[var(--muted-fg-hex)] mt-1">Your model's context window limit. Chat history is auto-trimmed to stay within this limit while reserving space for the document and system prompt.</p>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">Temperature: {settings.temperature.toFixed(1)}</label>
                <input type="range" min="0" max="2" step="0.1" value={settings.temperature}
                  onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })} className="w-full" />
                <div className="flex justify-between text-[10px] text-[var(--muted-fg-hex)] mt-0.5">
                  <span>Deterministic</span><span>Creative</span>
                </div>
              </div>

              {/* Advanced Inference */}
              <div className="border-t border-[var(--border-hex)] pt-4">
                <h3 className="text-xs font-semibold mb-3">Advanced Inference</h3>

                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">Top P: {settings.topP.toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.01" value={settings.topP}
                    onChange={(e) => updateSettings({ topP: parseFloat(e.target.value) })} className="w-full" />
                  <div className="flex justify-between text-[10px] text-[var(--muted-fg-hex)] mt-0.5">
                    <span>Focused</span><span>Diverse</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">Top K: {settings.topK}</label>
                  <input type="range" min="0" max="100" step="1" value={settings.topK}
                    onChange={(e) => updateSettings({ topK: parseInt(e.target.value) })} className="w-full" />
                  <div className="flex justify-between text-[10px] text-[var(--muted-fg-hex)] mt-0.5">
                    <span>Restrictive</span><span>Open</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">Frequency Penalty: {settings.frequencyPenalty.toFixed(1)}</label>
                  <input type="range" min="-2" max="2" step="0.1" value={settings.frequencyPenalty}
                    onChange={(e) => updateSettings({ frequencyPenalty: parseFloat(e.target.value) })} className="w-full" />
                  <div className="flex justify-between text-[10px] text-[var(--muted-fg-hex)] mt-0.5">
                    <span>Repeat more</span><span>Repeat less</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">Presence Penalty: {settings.presencePenalty.toFixed(1)}</label>
                  <input type="range" min="-2" max="2" step="0.1" value={settings.presencePenalty}
                    onChange={(e) => updateSettings({ presencePenalty: parseFloat(e.target.value) })} className="w-full" />
                  <div className="flex justify-between text-[10px] text-[var(--muted-fg-hex)] mt-0.5">
                    <span>Stay on topic</span><span>Explore new topics</span>
                  </div>
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">System Prompt</label>
                <textarea
                  value={settings.systemPrompt}
                  onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                  rows={6}
                  className={`${inputClass} resize-y`}
                  placeholder="Enter system prompt..."
                />
                <p className="text-[11px] text-[var(--muted-fg-hex)] mt-1">This prompt is sent to the LLM as context before each conversation.</p>
              </div>

              {/* Save */}
              <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-hex)]">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-md bg-[var(--primary-hex)] text-[var(--primary-fg-hex)] transition-all disabled:opacity-50 hover:scale-105 hover:brightness-110"
                >
                  {saved ? <Check size={14} /> : <SettingsIcon size={14} />}
                  {saved ? 'Saved!' : 'Save Settings'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* === Tools Tab === */}
        {activeTab === 'tools' && (
          <div className="space-y-5">
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <div className="flex items-start gap-2">
                <Zap size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">AI Tool Permissions</p>
                  <p className="text-amber-300/80">Control what the AI assistant can do when tools are enabled. Toggle the ⚡ button in the chat header to activate/deactivate.</p>
                </div>
              </div>
            </div>

            {/* Web Search */}
            <div className={toggleRow}>
              <div>
                <p className="text-xs font-medium">🔍 Web Search</p>
                <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to search the internet</p>
              </div>
              <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ webSearch: !toolPermissions.webSearch })}>
                <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.webSearch ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.webSearch ? 'translate-x-5' : ''}`} />
                </div>
              </label>
            </div>

            {/* File Tools Master Toggle */}
            <div className={toggleRow}>
              <div>
                <p className="text-xs font-medium">📁 Workspace Files</p>
                <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to access workspace files</p>
              </div>
              <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowFiles: !!toolPermissions.allowFiles ? false : true })}>
                <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowFiles ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowFiles ? 'translate-x-5' : ''}`} />
                </div>
              </label>
            </div>

            {/* Granular File Tool Permissions */}
            {toolPermissions.allowFiles && (
              <div className="border-t border-[var(--border-hex)] pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={14} className="text-[var(--primary-hex)]" />
                  <h3 className="text-xs font-semibold">File Tool Permissions</h3>
                </div>

                {/* Read */}
                <div className={toggleRow}>
                  <div>
                    <p className="text-xs font-medium">📖 Read & List</p>
                    <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to read files and list directories</p>
                  </div>
                  <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowRead: !!toolPermissions.allowRead ? false : true })}>
                    <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowRead ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowRead ? 'translate-x-5' : ''}`} />
                    </div>
                  </label>
                </div>

                {/* Write */}
                <div className={toggleRow}>
                  <div>
                    <p className="text-xs font-medium">✏️ Write & Edit</p>
                    <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to create, edit, copy, move files and create folders</p>
                  </div>
                  <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowWrite: !!toolPermissions.allowWrite ? false : true })}>
                    <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowWrite ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowWrite ? 'translate-x-5' : ''}`} />
                    </div>
                  </label>
                </div>

                {/* Delete */}
                <div className={toggleRow}>
                  <div>
                    <p className="text-xs font-medium">🗑️ Delete</p>
                    <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to delete files (cannot be undone)</p>
                  </div>
                  <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowDelete: !!toolPermissions.allowDelete ? false : true })}>
                    <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowDelete ? 'bg-red-500' : 'bg-[#3a3a4a]'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowDelete ? 'translate-x-5' : ''}`} />
                    </div>
                  </label>
                </div>

                {/* Rename */}
                <div className={toggleRow}>
                  <div>
                    <p className="text-xs font-medium">🔄 Rename</p>
                    <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to rename files</p>
                  </div>
                  <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowRename: !!toolPermissions.allowRename ? false : true })}>
                    <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowRename ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowRename ? 'translate-x-5' : ''}`} />
                    </div>
                  </label>
                </div>

                {/* Search */}
                <div className={toggleRow}>
                  <div>
                    <p className="text-xs font-medium">🔎 Search</p>
                    <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to search workspace files by content</p>
                  </div>
                  <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowSearch: !!toolPermissions.allowSearch ? false : true })}>
                    <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowSearch ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowSearch ? 'translate-x-5' : ''}`} />
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Feature Permissions */}
            <div className="border-t border-[var(--border-hex)] pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} className="text-[var(--primary-hex)]" />
                    <h3 className="text-xs font-semibold">Feature Permissions</h3>
                  </div>

                  {/* Knowledge Graph */}
                  <div className={toggleRow}>
                    <div>
                      <p className="text-xs font-medium">📊 Knowledge Graph</p>
                      <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to read/write your knowledge graph</p>
                    </div>
                    <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowGraph: !!toolPermissions.allowGraph ? false : true })}>
                      <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowGraph ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowGraph ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                  </div>

                  {/* Tags */}
                  <div className={toggleRow}>
                    <div>
                      <p className="text-xs font-medium">🏷️ Tags</p>
                      <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to manage file tags</p>
                    </div>
                    <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowTags: !!toolPermissions.allowTags ? false : true })}>
                      <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowTags ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowTags ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                  </div>

                  {/* Locations */}
                  <div className={toggleRow}>
                    <div>
                      <p className="text-xs font-medium">📍 Locations</p>
                      <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to manage file locations</p>
                    </div>
                    <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowLocations: !!toolPermissions.allowLocations ? false : true })}>
                      <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowLocations ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowLocations ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                  </div>

                  {/* User Files */}
                  <div className={toggleRow}>
                    <div>
                      <p className="text-xs font-medium">📁 User Files</p>
                      <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to search/read/create workspace files</p>
                    </div>
                    <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowFiles: !!toolPermissions.allowFiles ? false : true })}>
                      <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowFiles ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowFiles ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                  </div>

                  {/* Image Generation */}
                  <div className={toggleRow}>
                    <div>
                      <p className="text-xs font-medium">🎨 Image Generation</p>
                      <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to generate images via Z-Image</p>
                    </div>
                    <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowImageGen: !!toolPermissions.allowImageGen ? false : true })}>
                      <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowImageGen ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowImageGen ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                  </div>

                  {/* Reminders */}
                  <div className={toggleRow}>
                    <div>
                      <p className="text-xs font-medium">🔔 Reminders</p>
                      <p className="text-[11px] text-[var(--muted-fg-hex)] mt-0.5">Allow AI to manage reminders</p>
                    </div>
                    <label className="relative cursor-pointer" onClick={() => updateToolPermissions({ allowReminders: !!toolPermissions.allowReminders ? false : true })}>
                      <div className={`block w-10 h-5 rounded-full transition-colors ${toolPermissions.allowReminders ? 'bg-amber-500' : 'bg-[#3a3a4a]'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${toolPermissions.allowReminders ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Max Search Results */}
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">
                    🔍 Max Search Results: {toolPermissions.maxSearchResults}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={toolPermissions.maxSearchResults}
                    onChange={(e) => updateToolPermissions({ maxSearchResults: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--muted-fg-hex)] mt-0.5">
                    <span>Fewer results</span>
                    <span>More results</span>
                  </div>
                </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-hex)]">
              <button
                onClick={handleSavePermissions}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                {saved ? <Check size={14} /> : <Shield size={14} />}
                {saved ? 'Saved!' : 'Save Permissions'}
              </button>
            </div>
          </div>
        )}

        {/* === Images Tab === */}
        {activeTab === 'images' && (
          <div className="space-y-5">
            {/* Z-Image Info */}
            <div>
              <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                <Sparkles size={14} /> Z-Image (Nymphs2D2)
              </h3>
              <p className="text-[11px] text-[var(--muted-fg-hex)] mb-3">
                Local AI image generation via Z-Image-Turbo model. Images are generated on-demand and saved to your assets/images/ folder.
              </p>

              {/* Server Status */}
              <ImageGenStatusPanel />
            </div>
          </div>
        )}

        {/* === Editor Tab === */}
        {activeTab === 'editor' && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider">Max Open Tabs</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={maxTabs}
                  onChange={(e) => handleMaxTabsChange(parseInt(e.target.value) || 10)}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxTabs}
                  onChange={(e) => handleMaxTabsChange(parseInt(e.target.value) || 10)}
                  className="w-20 rounded-md bg-[var(--card-hex)] px-3 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[var(--primary-hex)]"
                />
              </div>
              <p className="text-[11px] text-[var(--muted-fg-hex)] mt-1">Maximum number of files that can be open as tabs simultaneously. Saved locally.</p>
            </div>

            {/* Sidebar Icons */}
            <div className="border-t border-[var(--border-hex)] pt-4">
              <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                <LayoutPanelLeft size={14} /> Sidebar Icons
              </h3>
              <p className="text-[11px] text-[var(--muted-fg-hex)] mb-3">Toggle visibility of sidebar icons. Explorer, Search, Starred, and Settings are always visible.</p>

              {SIDEBAR_ICONS.map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between py-2.5 border-b border-[var(--card-hex)] last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-[var(--muted-fg-hex)]" />
                    <span className="text-xs">{label}</span>
                  </div>
                  <label className="relative cursor-pointer" onClick={() => handleToggleVisibility(key)}>
                    <div className={`block w-10 h-5 rounded-full transition-colors ${sidebarVisibility[key] ? 'bg-[var(--primary-hex)]' : 'bg-[var(--border-hex)]'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${sidebarVisibility[key] ? 'translate-x-5' : ''}`} />
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === Appearance Tab === */}
        {activeTab === 'appearance' && (
          <div className="space-y-5">
            <ThemePicker />
          </div>
        )}
      </div>
    </div>
  );
}

function ImageGenStatusPanel() {
  const [status, setStatus] = useState<ImageGenStatusType | null>(null);
  const [checking, setChecking] = useState(false);
  const [zImageUrl, setZImageUrl] = useState(() => {
    try {
      return localStorage.getItem('wbu_zimage_url') || 'http://localhost:8090';
    } catch {
      return 'http://localhost:8090';
    }
  });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const st = await getImageGenerationStatus();
      setStatus(st);
    } catch {
      setStatus({ available: false, running: false });
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testZImageConnection(zImageUrl);
      if (result.success) {
        setTestResult(`Connected! Model: ${result.loadedModelId || 'unknown'}, Backend: ${result.backend || 'unknown'}`);
      } else {
        setTestResult(result.message || 'Connection failed');
      }
    } catch (err: any) {
      setTestResult(err.message || 'Connection failed');
    }
    setTesting(false);
  }, [zImageUrl]);

  const handleSaveUrl = useCallback(() => {
    localStorage.setItem('wbu_zimage_url', zImageUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [zImageUrl]);

  const isRunning = status?.running || false;

  return (
    <div className="rounded-md bg-[var(--card-hex)] p-4 space-y-3">
      {/* URL Config */}
      <div>
        <label className="block text-xs font-medium mb-1.5">Z-Image Server URL</label>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={zImageUrl}
            onChange={(e) => setZImageUrl(e.target.value)}
            placeholder="http://localhost:8090"
            className="flex-1 min-w-0 rounded-md bg-[var(--border-hex)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary-hex)]"
          />
          <button
            onClick={handleSaveUrl}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--primary-hex)]/20 text-[var(--primary-hex)] hover:bg-[var(--primary-hex)]/30 transition-colors flex-shrink-0"
          >
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        <p className="text-[11px] text-[var(--muted-fg-hex)] mt-1">URL of your externally running Z-Image (Nymphs2D2) server.</p>
      </div>

      {/* Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs">Connection</span>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-xs text-[var(--muted-fg-hex)]">{isRunning ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {isRunning && status && (
        <div className="space-y-1 text-[11px] text-[var(--muted-fg-hex)]">
          {status.backend && <div>Backend: {status.backend}</div>}
          {status.loadedModelId && <div>Model: {status.loadedModelId}</div>}
          {status.device && <div>Device: {status.device}</div>}
          {status.supportedModes && <div>Modes: {status.supportedModes.join(', ')}</div>}
        </div>
      )}

      {/* Test + Refresh */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[var(--primary-hex)]/20 text-[var(--primary-hex)] hover:bg-[var(--primary-hex)]/30 transition-colors disabled:opacity-50"
        >
          <Sparkles size={12} />
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          onClick={check}
          disabled={checking}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[var(--border-hex)] hover:bg-[var(--card-hex)] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {testResult && (
        <div className={`text-xs ${testResult.startsWith('Connected') ? 'text-green-400' : 'text-red-400'}`}>
          {testResult}
        </div>
      )}

      {status?.error && (
        <div className="text-xs text-red-400">{status.error}</div>
      )}
    </div>
  );
}

