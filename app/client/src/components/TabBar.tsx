import { useState, useRef, useEffect, useCallback, type RefObject } from 'react';
import { X } from 'lucide-react';
import type { Tab } from '../hooks/useFiles';

interface TabBarProps {
  tabs: Record<string, Tab>;
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
  /** Called when closing a dirty tab — parent should show a confirm dialog */
  onConfirmDirtyClose?: (tabId: string, tabName: string) => void;
  /** Synchronous ref tracking dirty tab IDs (bypasses React state batching) */
  dirtyTabIdsRef?: RefObject<Set<string>>;
}

interface ContextMenuState {
  x: number;
  y: number;
  tabId: string;
}

export function TabBar({ tabs, activeTabId, onSwitch, onClose, onCloseOthers, onCloseAll, onConfirmDirtyClose, dirtyTabIdsRef }: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close context menu on scroll
  useEffect(() => {
    const handleScroll = () => setContextMenu(null);
    const el = tabListRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Auto-scroll to keep active tab visible
  useEffect(() => {
    if (activeTabId && tabListRef.current) {
      const activeEl = tabListRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  // Always delegate close to parent — parent handles dirty check
  const handleCloseClick = (e: React.MouseEvent, tabId: string, _tabName: string) => {
    e.stopPropagation();
    setContextMenu(null);
    onClose(tabId);
  };

  const handleContextMenuAction = useCallback((action: string) => {
    if (!contextMenu) return;
    const tab = tabs[contextMenu.tabId];
    if (!tab) {
      setContextMenu(null);
      return;
    }

    if (action === 'close') {
      onClose(contextMenu.tabId);
    } else if (action === 'closeOthers') {
      onCloseOthers(contextMenu.tabId);
    } else if (action === 'closeAll') {
      onCloseAll();
    }

    setContextMenu(null);
  }, [contextMenu, tabs, onClose, onCloseOthers, onCloseAll, onConfirmDirtyClose, dirtyTabIdsRef]);

  const tabEntries = Object.values(tabs);

  if (tabEntries.length === 0) return null;

  return (
    <div className="flex items-center bg-accent/50 border-b border-border">
      <div
        ref={tabListRef}
        className="flex items-center overflow-x-auto flex-1 scrollbar-thin"
      >
        {tabEntries.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={isActive}
              className={`group flex items-center gap-2 px-4 py-2.5 text-sm border-r border-border cursor-pointer select-none min-w-0 max-w-[200px] transition-colors ${
                isActive
                  ? 'bg-background text-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-background/50'
              }`}
              onClick={() => onSwitch(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
            >
              <span className="truncate flex-1">{tab.name}</span>
              {tab.dirty && (
                <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" title="Unsaved changes" />
              )}
              <button
                className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={(e) => handleCloseClick(e, tab.id, tab.name)}
                title="Close tab"
              >
                 <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] py-1 rounded-md bg-popover border border-border shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
            onClick={() => handleContextMenuAction('close')}
          >
            Close
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
            onClick={() => handleContextMenuAction('closeOthers')}
          >
            Close Others
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
            onClick={() => handleContextMenuAction('closeAll')}
          >
            Close All
          </button>
        </div>
      )}
    </div>
  );
}