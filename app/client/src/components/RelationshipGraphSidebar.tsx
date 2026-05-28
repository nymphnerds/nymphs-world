import React, { useState } from 'react';
import {
  Network, RefreshCw, Eye, Layers,
  FileText, Trash2, Tags, MapPin, Calendar
} from 'lucide-react';

const RELATIONSHIP_TYPES = [
  { id: 'character_connection', label: 'Character Connection', color: '#f59e0b' },
  { id: 'location_connection', label: 'Location Connection', color: '#22c55e' },
  { id: 'time_connection', label: 'Time Connection', color: '#38bdf8' },
  { id: 'thematic', label: 'Thematic', color: '#a78bfa' },
  { id: 'narrative', label: 'Narrative', color: '#3b82f6' },
];

interface RelationshipGraphSidebarProps {
  seedPath: string | null;
  onGenerate: (seedPath: string, relTypes: string[], useAI: boolean, depth: 1 | 2) => void;
  onViewCached: () => void;
  onClear: () => void;
  loading: boolean;
  error: string | null;
  hasCache: boolean;
  mergeMessage: string | null;
}

// Toggle switch component
function ToggleSwitch({
  checked,
  onChange,
  color = '#a78bfa',
}: {
  checked: boolean;
  onChange: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onChange}
      className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${checked ? '' : 'bg-[#444]'}`}
      style={checked ? { backgroundColor: color } : {}}
    >
      <div
        className="w-3 h-3 rounded-full bg-white transition-transform ml-0.5"
        style={{
          marginTop: '2px',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
        }}
      />
    </button>
  );
}

const RelationshipGraphSidebar: React.FC<RelationshipGraphSidebarProps> = ({
  seedPath,
  onGenerate,
  onViewCached,
  onClear,
  loading,
  error,
  hasCache,
  mergeMessage,
}) => {
  const [selectedRelTypes, setSelectedRelTypes] = useState<string[]>(RELATIONSHIP_TYPES.map(rt => rt.id));
  const [depth, setDepth] = useState<1 | 2>(1);
  const [showRelTypePicker, setShowRelTypePicker] = useState(false);

  // Instant metadata-based toggles
  const [tagBased, setTagBased] = useState(false);
  const [eraBased, setEraBased] = useState(false);
  const [locationBased, setLocationBased] = useState(false);

  // Any instant toggle active?
  const anyInstantOn = tagBased || eraBased || locationBased;
  // AI mode is implicit: when no instant toggles are on, AI is used
  const isAIMode = !anyInstantOn;

  // View cached graph on demand
  const handleViewCached = () => {
    if (hasCache) {
      onViewCached();
    }
  };

  const handleGenerate = () => {
    if (seedPath) {
      const effectiveUseAI = !anyInstantOn;
      const effectiveRelTypes = anyInstantOn ? [] : selectedRelTypes;
      onGenerate(seedPath, effectiveRelTypes, effectiveUseAI, depth);
    }
  };

  // Display name for seed: strip folder and .html
  const seedDisplay = seedPath
    ? seedPath.replace(/\.html$/, '').split('/').pop() || seedPath
    : null;

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#3a3a4a]">
        <h3 className="font-semibold text-sm text-[#e0e0e0]">Relationship Graph</h3>
        <p className="text-[11px] text-[#888] mt-0.5">Explore connections from a document</p>
      </div>

      {/* Seed Display */}
      <div className="px-3 py-2 border-b border-[#3a3a4a]">
        <label className="font-medium text-xs uppercase tracking-wider text-[#888] block mb-1.5">
          Seed Document
        </label>
        {seedPath ? (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-[#2a2a3a] border border-[#a78bfa]/30">
            <FileText size={14} className="text-[#a78bfa] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-[#e0e0e0] truncate font-medium">{seedDisplay}</div>
              <div className="text-[10px] text-[#888] truncate">{seedPath}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-[#2a2a3a] border border-dashed border-[#555]">
            <FileText size={14} className="text-[#666] flex-shrink-0" />
            <div className="text-[11px] text-[#888]">Open a document to use it as seed</div>
          </div>
        )}
      </div>

      {/* Analysis Mode */}
      <div className="px-3 py-2 border-b border-[#3a3a4a]">
        <label className="font-medium text-xs uppercase tracking-wider text-[#888] block mb-1.5">
          Analysis Mode
        </label>
        <div className="space-y-1.5">
          {/* Instant Connections Group */}
          <div className="space-y-0.5">
            <div className="text-[10px] text-[#666] uppercase tracking-wider mb-1">Instant</div>

            {/* Tag-Based */}
            <button
              onClick={() => setTagBased(!tagBased)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors ${
                tagBased
                  ? 'bg-[#6b7280]/20 text-[#a0a0a0] border border-[#6b7280]/30'
                  : 'text-[#ccc] hover:bg-[#2a2a3a] border border-transparent'
              }`}
            >
              <Tags size={12} />
              <div className="text-left flex-1">
                <div className="font-medium">Tag-Based</div>
                <div className="text-[10px] opacity-60">Shared tags</div>
              </div>
              <ToggleSwitch checked={tagBased} onChange={() => {}} color="#6b7280" />
            </button>

            {/* Era-Based */}
            <button
              onClick={() => setEraBased(!eraBased)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors ${
                eraBased
                  ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/30'
                  : 'text-[#ccc] hover:bg-[#2a2a3a] border border-transparent'
              }`}
            >
              <Calendar size={12} />
              <div className="text-left flex-1">
                <div className="font-medium">Era-Based</div>
                <div className="text-[10px] opacity-60">Same era</div>
              </div>
              <ToggleSwitch checked={eraBased} onChange={() => {}} color="#f97316" />
            </button>

            {/* Location-Based */}
            <button
              onClick={() => setLocationBased(!locationBased)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors ${
                locationBased
                  ? 'bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/30'
                  : 'text-[#ccc] hover:bg-[#2a2a3a] border border-transparent'
              }`}
            >
              <MapPin size={12} />
              <div className="text-left flex-1">
                <div className="font-medium">Location-Based</div>
                <div className="text-[10px] opacity-60">Same location</div>
              </div>
              <ToggleSwitch checked={locationBased} onChange={() => {}} color="#14b8a6" />
            </button>
          </div>

          {/* Depth Selector */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-[#888]">Depth:</span>
            <button
              onClick={() => setDepth(1)}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                depth === 1
                  ? 'bg-[#a78bfa]/20 text-[#a78bfa]'
                  : 'text-[#888] hover:bg-[#2a2a3a]'
              }`}
            >
              1-Hop
            </button>
            <button
              onClick={() => setDepth(2)}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                depth === 2
                  ? 'bg-[#a78bfa]/20 text-[#a78bfa]'
                  : 'text-[#888] hover:bg-[#2a2a3a]'
              }`}
            >
              2-Hop
            </button>
            <span className="text-[10px] text-[#666]">
              {depth === 1 ? 'Direct connections' : 'Connections + their connections'}
            </span>
          </div>
        </div>
      </div>

      {/* Relationship Types */}
      <div className="px-3 py-2 border-b border-[#3a3a4a]">
        <div className="flex items-center justify-between mb-1.5">
          <label className="font-medium text-xs uppercase tracking-wider text-[#888]">
            Relationship Types
          </label>
          {!anyInstantOn && selectedRelTypes.length > 0 && (
            <button
              onClick={() => setSelectedRelTypes([])}
              className="text-[10px] text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <button
          onClick={() => !anyInstantOn && setShowRelTypePicker(!showRelTypePicker)}
          disabled={anyInstantOn}
          className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors ${
            anyInstantOn
              ? 'bg-[#1a1a2a] text-[#555] cursor-not-allowed border border-[#333]'
              : 'bg-[#2a2a3a] text-[#e0e0e0] hover:bg-[#3a3a4a] border border-transparent'
          }`}
        >
          <Layers size={12} />
          <span>{anyInstantOn ? 'Disabled (instant mode)' : `${selectedRelTypes.length} type(s) selected`}</span>
          {anyInstantOn ? (
            <span className="ml-auto text-[10px] text-[#444]">🔒</span>
          ) : (
            <span className="ml-auto text-[10px] text-[#666]">▼</span>
          )}
        </button>

        {!anyInstantOn && showRelTypePicker && (
          <div className="mt-1.5 rounded-md border border-[#3a3a4a] bg-[#2a2a3a] p-1.5">
            {RELATIONSHIP_TYPES.map(rt => {
              const isSelected = selectedRelTypes.includes(rt.id);
              return (
                <button
                  key={rt.id}
                  onClick={() => {
                    setSelectedRelTypes(prev =>
                      isSelected
                        ? prev.filter(id => id !== rt.id)
                        : [...prev, rt.id]
                    );
                  }}
                  className={`flex items-center gap-2 w-full px-2 py-1 rounded text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#a78bfa]/20 text-[#a78bfa] border border-[#a78bfa]/30'
                      : 'text-[#e0e0e0] hover:bg-[#3a3a4a] border border-transparent'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: rt.color }}
                  />
                  <span>{rt.label}</span>
                  {isSelected && <span className="ml-auto"><CheckIcon size={12} /></span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-3 mt-auto space-y-2">
        {isAIMode && (
          <div className="px-2.5 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300/80 text-[11px] leading-relaxed">
            ⚠️ AI analysis may take time and incur API costs on cloud LLMs.
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !seedPath}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs rounded-md bg-[#a78bfa]/20 text-[#a78bfa] hover:bg-[#a78bfa]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Network size={14} />
              {anyInstantOn ? 'Generate (Instant)' : 'Generate with AI'}
            </>
          )}
        </button>

        {hasCache && (
          <button
            onClick={handleViewCached}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs rounded-md bg-[#2a2a3a] text-[#e0e0e0] hover:bg-[#3a3a4a] transition-colors disabled:opacity-50"
          >
            <Eye size={14} />
            View Cached Graph
          </button>
        )}

        {mergeMessage && (
          <div className="px-2.5 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/80 text-xs">
            {mergeMessage}
          </div>
        )}

        {error && (
          <div className="px-2.5 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {hasCache && (
          <button
            onClick={onClear}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
            Clear Graph
          </button>
        )}
      </div>
    </div>
  );
};

// Simple check icon for relationship type selection
function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default RelationshipGraphSidebar;