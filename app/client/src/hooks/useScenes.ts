import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getScenes,
  createScene as apiCreateScene,
  updateScene as apiUpdateScene,
  deleteScene as apiDeleteScene,
  getFileScenes,
  addScenesToFile,
  removeSceneFromFile,
  Scene,
} from '../services/api';

// --- Registry color fallback ---
function getLocationColorRegistry(): Record<string, string> {
  return (window as any).__wbuLocationColors || {};
}

// ============================================================
// useScenes — global workspace scenes
// ============================================================

export function useScenes() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScenes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getScenes();
      setScenes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  // Listen for external changes (e.g., another component created/deleted a scene)
  useEffect(() => {
    const handler = () => fetchScenes();
    window.addEventListener('wbu-scenes-changed', handler);
    return () => window.removeEventListener('wbu-scenes-changed', handler);
  }, [fetchScenes]);

  const createScene = useCallback(
    async (name: string, era: string, date: string, locationName: string): Promise<Scene> => {
      const scene = await apiCreateScene(name, era, date, locationName);
      setScenes(prev => [...prev, scene]);
      window.dispatchEvent(new CustomEvent('wbu-scenes-changed'));
      return scene;
    },
    []
  );

  const updateScene = useCallback(
    async (id: string, updates: Partial<Pick<Scene, 'name' | 'era' | 'date' | 'locationName'>>): Promise<Scene> => {
      const scene = await apiUpdateScene(id, updates);
      setScenes(prev => prev.map(s => (s.id === id ? scene : s)));
      window.dispatchEvent(new CustomEvent('wbu-scenes-changed'));
      return scene;
    },
    []
  );

  const deleteScene = useCallback(async (id: string): Promise<void> => {
    await apiDeleteScene(id);
    setScenes(prev => prev.filter(s => s.id !== id));
    window.dispatchEvent(new CustomEvent('wbu-scenes-changed'));
  }, []);

  const getById = useCallback(
    (id: string): Scene | undefined => scenes.find(s => s.id === id),
    [scenes]
  );

  const getLocationColor = useCallback((locName: string): string => {
    const registry = getLocationColorRegistry();
    return registry[locName] || '#10b981';
  }, []);

  return {
    scenes,
    loading,
    error,
    refetch: fetchScenes,
    createScene,
    updateScene,
    deleteScene,
    getById,
    getLocationColor,
  };
}

// ============================================================
// useFileScenes — scenes assigned to a specific file
// ============================================================

export function useFileScenes(filePath: string | null) {
  const [fileSceneIds, setFileSceneIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { scenes } = useScenes();

  // Resolve full scene objects from IDs
  const fileScenes = useMemo(() => {
    return fileSceneIds
      .map(id => scenes.find(s => s.id === id))
      .filter((s): s is Scene => Boolean(s));
  }, [fileSceneIds, scenes]);

  const fetchFileScenes = useCallback(async () => {
    if (!filePath) {
      setFileSceneIds([]);
      return;
    }
    setLoading(true);
    try {
      const ids = await getFileScenes(filePath);
      setFileSceneIds(ids);
    } catch {
      // Silent fail — file may not exist yet
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    fetchFileScenes();
  }, [fetchFileScenes]);

  // Refetch when workspace scenes change (so fileScenes resolves correctly)
  useEffect(() => {
    if (filePath) {
      fetchFileScenes();
    }
  }, [scenes.length, filePath, fetchFileScenes]);

  // Listen for external file-scene changes
  useEffect(() => {
    if (!filePath) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.filePath === filePath) {
        fetchFileScenes();
      }
    };
    window.addEventListener('wbu-file-scenes-changed', handler);
    return () => window.removeEventListener('wbu-file-scenes-changed', handler);
  }, [filePath, fetchFileScenes]);

  const addScenes = useCallback(
    async (sceneIds: string[]) => {
      if (!filePath) return;
      await addScenesToFile(filePath, sceneIds);
      setFileSceneIds(prev => [...new Set([...prev, ...sceneIds])]);
      window.dispatchEvent(
        new CustomEvent('wbu-file-scenes-changed', { detail: { filePath } })
      );
    },
    [filePath]
  );

  const removeScene = useCallback(
    async (sceneId: string) => {
      if (!filePath) return;
      await removeSceneFromFile(filePath, sceneId);
      setFileSceneIds(prev => prev.filter(id => id !== sceneId));
      window.dispatchEvent(
        new CustomEvent('wbu-file-scenes-changed', { detail: { filePath } })
      );
    },
    [filePath]
  );

  return {
    fileSceneIds,
    fileScenes,
    loading,
    addScenes,
    removeScene,
    refetch: fetchFileScenes,
  };
}