import { useState, useCallback, useEffect } from 'react';
import { GitBranch, FileText, Tag, AlertCircle } from 'lucide-react';
import { useTagQueries } from '../hooks/useTags';
import { useTags } from '../hooks/useTags';
import type { RelationshipTarget } from '../services/api';

interface RelationshipsPanelProps {
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
}

export function RelationshipsPanel({ activeFilePath, onFileSelect }: RelationshipsPanelProps) {
  const { relationships, loading, error, fetchRelationships } = useTagQueries();
  const { getByColor } = useTags();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (activeFilePath) {
      setRefreshing(true);
      fetchRelationships(activeFilePath).finally(() => setRefreshing(false));
    }
  }, [activeFilePath, fetchRelationships]);

  const handleFileClick = useCallback((path: string) => {
    onFileSelect(path);
  }, [onFileSelect]);

  // Empty state: no file open
  if (!activeFilePath) {
    return (
      <div className="flex flex-col h-full bg-[hsl(225,15%,8%)] text-gray-200">
        <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 border-b border-[#3a3a4a]">
          <span className="flex items-center gap-1.5">
            <GitBranch size={14} />
            Relationships
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <GitBranch size={32} className="mx-auto text-[#4a4a5a] mb-3" />
            <p className="text-sm text-[#888] mb-1">No file open</p>
            <p className="text-[11px] text-[#6a6a7a]">Open a file to see related documents.</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract the filename from the path
  const activeFileName = activeFilePath.split('/').pop() || activeFilePath;

  return (
    <div className="flex flex-col h-full bg-[hsl(225,15%,8%)] text-gray-200">
      <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 border-b border-[#3a3a4a]">
        <span className="flex items-center gap-1.5">
          <GitBranch size={14} />
          Relationships
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active file header */}
        <div className="px-3 py-2 border-b border-[#2a2a3a]">
          <p className="text-[11px] text-[#888] mb-0.5">Active file</p>
          <p className="text-sm text-white font-medium truncate">{activeFileName}</p>
        </div>

        {/* Error state */}
        {error && (
          <div className="mx-3 mt-3 p-3 rounded-md bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Loading state */}
        {(loading || refreshing) && !relationships ? (
          <div className="px-3 py-6 text-xs text-[#888] text-center">Loading...</div>
        ) : null}

        {/* Relationships content */}
        {relationships && !loading && !refreshing && (
          <>
            {/* Summary */}
            <div className="px-3 py-2 text-xs text-[#888]">
              {relationships.implicit.length} related document{relationships.implicit.length !== 1 ? 's' : ''}
            </div>

            {/* Implicit relationships list */}
            {relationships.implicit.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <Tag size={24} className="mx-auto text-[#4a4a5a] mb-2" />
                <p className="text-xs text-[#888]">No shared tags found.</p>
                <p className="text-[11px] text-[#6a6a7a] mt-1">Add tags to this file to discover relationships.</p>
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1.5">
                {relationships.implicit.map((rel: RelationshipTarget) => (
                  <RelationshipCard
                    key={rel.path}
                    rel={rel}
                    getTagColor={getByColor}
                    onClick={() => handleFileClick(rel.path)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RelationshipCard({
  rel,
  getTagColor,
  onClick,
}: {
  rel: RelationshipTarget;
  getTagColor: (tagName: string) => string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm ${
        hovered ? 'bg-[#2a2a3a]' : 'bg-transparent'
      }`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <FileText size={14} className="text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#e0e0e0] truncate">{rel.name}</p>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <Tag size={10} className="text-[#6a6a7a]" />
          {rel.sharedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: getTagColor(tag) + '33', color: getTagColor(tag) }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getTagColor(tag) }} />
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RelationshipsPanel;