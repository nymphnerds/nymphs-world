import { useEffect, useRef } from 'react';

interface SessionState {
  tabs: string[];
  activeTabPath: string | null;
  explorerPath: string;
  activeActivity: string;
  showAISidebar: boolean;
  lastSaved: string;
}

const SESSION_KEY = 'wbu-session';

export function useSessionPersistence(options: {
  tabs: Record<string, { path: string }>;
  activeTabId: string | null;
  explorerPath: string;
  activeActivity: string;
  showAISidebar: boolean;
  isAuthenticated: boolean;
  // Restore callbacks
  onRestore: (session: SessionState) => void;
}) {
  const {
    tabs,
    activeTabId,
    explorerPath,
    activeActivity,
    showAISidebar,
    isAuthenticated,
    onRestore,
  } = options;

  const restoredRef = useRef(false);

  // Save session whenever tracked state changes
  useEffect(() => {
    if (!isAuthenticated) return;

    const tabPaths = Object.values(tabs).map((t) => t.path);
    const activeTabPath = activeTabId ? tabs[activeTabId]?.path || null : null;

    const session: SessionState = {
      tabs: tabPaths,
      activeTabPath,
      explorerPath,
      activeActivity,
      showAISidebar,
      lastSaved: new Date().toISOString(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, [tabs, activeTabId, explorerPath, activeActivity, showAISidebar, isAuthenticated]);

  // Restore session on mount (only when already authenticated, i.e., token survived in localStorage)
  useEffect(() => {
    // Only restore once per mount
    if (restoredRef.current || !isAuthenticated) return;

    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;

    try {
      const session: SessionState = JSON.parse(saved);
      restoredRef.current = true;
      onRestore(session);
    } catch {
      // Corrupted session data — clear and start fresh
      localStorage.removeItem(SESSION_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Export SESSION_KEY so logout can reference it
export { SESSION_KEY };