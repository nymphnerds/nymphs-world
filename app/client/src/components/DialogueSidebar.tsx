import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Film, ChevronDown, AlertCircle } from 'lucide-react';
import { Scene } from '../services/api';
import { useScenes } from '../hooks/useScenes';

interface DialogueSidebarProps {
  onOpenDialogue: (scene: Scene) => void;
}

// Skeleton loading placeholder
const DialogueSkeleton: React.FC = () => (
  <div className="dialogue-skeleton">
    <div className="dialogue-skeleton-era" />
    <div className="dialogue-skeleton-scene" />
    <div className="dialogue-skeleton-scene" />
    <div className="dialogue-skeleton-era" />
    <div className="dialogue-skeleton-scene" />
  </div>
);

export const DialogueSidebar: React.FC<DialogueSidebarProps> = ({ onOpenDialogue }) => {
  const { scenes, loading, error } = useScenes();
  const [collapsedEras, setCollapsedEras] = useState<Set<string>>(new Set());

  // Group scenes by era
  const erasMap = useMemo(() => {
    const map = new Map<string, Scene[]>();
    for (const scene of scenes) {
      const era = scene.era || 'No Era';
      const list = map.get(era) || [];
      list.push(scene);
      map.set(era, list);
    }
    return map;
  }, [scenes]);

  const toggleEra = useCallback((era: string) => {
    setCollapsedEras(prev => {
      const next = new Set(prev);
      if (next.has(era)) {
        next.delete(era);
      } else {
        next.add(era);
      }
      return next;
    });
  }, []);

  if (error) {
    return (
      <div className="dialogue-panel">
        <div className="dialogue-header">
          <span>Dialogue</span>
        </div>
        <div className="dialogue-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dialogue-panel">
      <div className="dialogue-header">
        <span>Dialogue</span>
        <span className="dialogue-scene-total">{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <DialogueSkeleton />
      ) : erasMap.size === 0 ? (
        <div className="dialogue-empty">
          <div className="dialogue-empty-icon">
            <MessageSquare size={32} />
          </div>
          <span>No scenes yet.</span>
          <span style={{ fontSize: '0.65rem', marginTop: '4px' }}>
            Create scenes in the <code>Timeline</code> sidebar first.
          </span>
        </div>
      ) : (
        <div className="dialogue-content">
          {Array.from(erasMap.entries()).map(([era, eraScenes]) => {
            const isCollapsed = collapsedEras.has(era);
            return (
              <div key={era} className="dialogue-era">
                <button
                  className="dialogue-era-header"
                  onClick={() => toggleEra(era)}
                >
                  <span className={`dialogue-era-arrow ${isCollapsed ? 'collapsed' : ''}`}>
                    <ChevronDown size={10} />
                  </span>
                  <span className="dialogue-era-name">{era}</span>
                  <span className="dialogue-era-count">{eraScenes.length}</span>
                </button>

                {!isCollapsed && (
                  <div className="dialogue-era-scenes">
                    {eraScenes.map(scene => (
                      <div key={scene.id} className="dialogue-scene">
                        <button
                          className="dialogue-scene-btn"
                          onClick={() => onOpenDialogue(scene)}
                          title={`Open dialogue for "${scene.name}"`}
                        >
                          <span className="dialogue-scene-icon">
                            <Film size={12} />
                          </span>
                          <span className="dialogue-scene-name">{scene.name}</span>
                          {scene.date && (
                            <span className="dialogue-scene-date">{scene.date}</span>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};