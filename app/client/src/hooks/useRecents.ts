import { useState, useCallback, useEffect } from 'react';
import { getUserRecents, saveUserRecents, getUserStarred, saveUserStarred, UserRecentFile, UserStarredFile } from '../services/api';

const MAX_RECENTS = 10;

// Immediate save helper — recents and starred are tiny arrays (max 10 items)
// so there is no performance reason to debounce. Saving immediately ensures
// data is persisted before the user logs out, closes the tab, or navigates away.
function saveImmediately<T>(data: T, saveFn: (d: T) => Promise<void>) {
  saveFn(data).catch(() => {
    // Silently fail — data is still in local state
  });
}

export function useRecents(refreshKey = 0) {
  const [recentFiles, setRecentFiles] = useState<UserRecentFile[]>([]);
  const [starredFiles, setStarredFiles] = useState<UserStarredFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from server on mount
  const loadFromServer = useCallback(async () => {
    try {
      const [recents, starred] = await Promise.all([
        getUserRecents(),
        getUserStarred(),
      ]);
      setRecentFiles(recents);
      setStarredFiles(starred);
      setLoading(false);
    } catch {
      setRecentFiles([]);
      setStarredFiles([]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    // Immediately clear stale data and re-enter loading so the debounced
    // save effects don't flush old-user data during a login transition
    setRecentFiles([]);
    setStarredFiles([]);
    setLoading(true);
    
    (async () => {
      try {
        const [recents, starred] = await Promise.all([
          getUserRecents(),
          getUserStarred(),
        ]);
        if (mounted) {
          setRecentFiles(recents);
          setStarredFiles(starred);
          setLoading(false);
        }
      } catch {
        // Do NOT clear existing state on failure — preserves starred files
        // when the server is temporarily unreachable (e.g., during restart).
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const addRecentFile = useCallback((path: string) => {
    const name = path.split('/').pop() || path;
    setRecentFiles(prev => {
      const filtered = prev.filter(r => r.path !== path);
      const updated = [{ path, name, lastOpened: Date.now() }, ...filtered];
      return updated.slice(0, MAX_RECENTS);
    });
  }, []);

  // Immediately save recents when they change
  useEffect(() => {
    if (!loading) {
      saveImmediately(recentFiles, saveUserRecents);
    }
  }, [recentFiles, loading]);

  const toggleStar = useCallback((path: string) => {
    const name = path.split('/').pop() || path;
    setStarredFiles(prev => {
      const exists = prev.find(s => s.path === path);
      if (exists) {
        return prev.filter(s => s.path !== path);
      }
      return [...prev, { path, name }];
    });
  }, []);

  // Immediately save starred when they change
  useEffect(() => {
    if (!loading) {
      saveImmediately(starredFiles, saveUserStarred);
    }
  }, [starredFiles, loading]);

  const isStarred = useCallback((path: string) => {
    return starredFiles.some(s => s.path === path);
  }, [starredFiles]);

  const removeRecent = useCallback((path: string) => {
    setRecentFiles(prev => prev.filter(r => r.path !== path));
  }, []);

  const removeStar = useCallback((path: string) => {
    setStarredFiles(prev => prev.filter(s => s.path !== path));
  }, []);

  const clearRecents = useCallback(() => {
    setRecentFiles([]);
  }, []);

  return {
    recentFiles,
    starredFiles,
    loading,
    addRecentFile,
    toggleStar,
    isStarred,
    removeRecent,
    removeStar,
    clearRecents,
  };
}