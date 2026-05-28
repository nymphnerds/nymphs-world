import { useState, useCallback, useRef, useEffect } from 'react';
import {
  listFiles,
  getFileContent,
  createFile,
  createFolder,
  updateFile,
  deleteItem,
  renameItem,
  copyFile,
  moveFile,
  uploadImage,
  uploadFile,
  type FileItem,
} from '../services/api';
import type { FsOperation } from './useFileSystemUndoRedo';

export interface Tab {
  id: string;
  path: string;
  name: string;
  content: string;
  originalContent: string;
  dirty: boolean;
  /** Hidden Build/Template metadata lines extracted from .txt files */
  buildMetadata?: string[];
}

const MAX_TABS_KEY = 'wbu_maxTabs';

function getFileName(path: string): string {
  return (path.split('/').pop() || path).replace(/\.html$/i, '');
}

export function getMaxTabs(): number {
  const stored = localStorage.getItem(MAX_TABS_KEY);
  return stored ? parseInt(stored, 10) : 10;
}

export function setMaxTabs(n: number): void {
  localStorage.setItem(MAX_TABS_KEY, String(n));
}

let tabCounter = 0;

export function useFiles(pushUndo?: (op: FsOperation) => void, showFolderPicker?: (defaultFolder?: string) => Promise<string>) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [tabs, setTabs] = useState<Record<string, Tab>>({});
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronous dirty tracking via ref — updated immediately when content changes,
  // bypassing React's state batching so tab-close checks always see the latest state
  const dirtyTabIdsRef = useRef<Set<string>>(new Set());

  // Sync dirty ref when tabs are saved/cleared (not on every render to avoid
  // overwriting the synchronous add() from updateTabContent before React re-renders)
  // The ref is managed synchronously: add() in updateTabContent, delete() in saveTab/saveActiveTab/restoreToOriginal/closeTab

  // Derived values for compatibility
  const currentPath = activeTabId ? tabs[activeTabId]?.path || null : null;
  const content = activeTabId ? tabs[activeTabId]?.content || '' : '';

  const loadFiles = useCallback(async (path = '') => {
    setLoading(true);
    setError(null);
    try {
      const items = await listFiles(path);
      setFiles(items);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const openTab = useCallback(async (path: string): Promise<{ content: string; id: string } | null> => {
    // Check if tab already exists
    const existingId = Object.values(tabs).find(t => t.path === path)?.id;
    if (existingId) {
      setActiveTabId(existingId);
      // Return existing tab's content and ID
      return { content: tabs[existingId]?.content || '', id: existingId };
    }

    // Check tab limit
    const maxTabs = getMaxTabs();
    if (Object.keys(tabs).length >= maxTabs) {
      setError(`Maximum ${maxTabs} tabs open. Close a tab first.`);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const fileContent = await getFileContent(path);
      const id = `tab_${Date.now()}_${tabCounter++}`;
      setTabs(prev => ({
        ...prev,
        [id]: {
          id,
          path,
          name: getFileName(path),
          content: fileContent,
          originalContent: fileContent,
          dirty: false,
        }
      }));
      setActiveTabId(id);
      return { content: fileContent, id };
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tabs]);

  const closeTab = useCallback((id: string, saveDirty: 'save' | 'discard' | 'cancel' = 'discard') => {
    const tab = tabs[id];
    if (!tab) return false;

    // Clear from dirty ref when closing
    dirtyTabIdsRef.current.delete(id);

    if (tab.dirty && saveDirty === 'cancel') return false;

    if (saveDirty === 'save') {
      // Save before closing (caller handles async)
      return true;
    }

    setTabs(prev => {
      const newTabs = { ...prev };
      delete newTabs[id];

      // Use functional update to check current activeTabId at commit time
      if (activeTabId === id) {
        const remainingIds = Object.keys(newTabs);
        setActiveTabId(remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null);
      }
      return newTabs;
    });

    // Handle case where a non-active tab is closed
    if (activeTabId !== id) {
      // No change needed - active tab stays the same
    }
    return true;
  }, [tabs, activeTabId]);

  const switchTab = useCallback((id: string) => {
    if (tabs[id]) {
      setActiveTabId(id);
    }
  }, [tabs]);

  const updateTabContent = useCallback((id: string, newContent: string) => {
    // Update ref synchronously so close-tab checks see dirty=true immediately
    dirtyTabIdsRef.current.add(id);
    setTabs(prev => ({
      ...prev,
      [id]: { ...prev[id], content: newContent, dirty: true }
    }));
  }, []);

  const setTabBuildMetadata = useCallback((id: string, metadata: string[]) => {
    setTabs(prev => ({
      ...prev,
      [id]: { ...prev[id], buildMetadata: metadata }
    }));
  }, []);

  const saveActiveTab = useCallback(async (content?: string) => {
    const tab = activeTabId ? tabs[activeTabId] : null;
    if (!tab) return;
    setLoading(true);
    setError(null);
    try {
      const savedContent = content ?? tab.content;
      await updateFile(tab.path, savedContent);
      // Clear dirty ref synchronously
      dirtyTabIdsRef.current.delete(tab.id);
      setTabs(prev => ({
        ...prev,
        [tab.id]: { ...prev[tab.id], dirty: false }
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTabId, tabs]);

  const restoreToOriginal = useCallback((id?: string) => {
    const tabId = id || activeTabId;
    if (!tabId) return;
    const tab = tabs[tabId];
    if (!tab || tab.content === tab.originalContent) return;
    // Clear dirty ref synchronously
    dirtyTabIdsRef.current.delete(tabId);
    setTabs(prev => ({
      ...prev,
      [tabId]: { ...prev[tabId], content: prev[tabId].originalContent, dirty: false }
    }));
  }, [activeTabId, tabs]);

  /**
   * Reload a tab's content from the server.
   * Used when the LLM chat edits a file that is currently open in a tab.
   * Only reloads if the tab is not dirty (has unsaved local edits).
   */
  const reloadTab = useCallback(async (id: string) => {
    const tab = tabs[id];
    if (!tab) return;
    // Do not overwrite unsaved local edits
    if (tab.dirty) return;
    try {
      const freshContent = await getFileContent(tab.path);
      dirtyTabIdsRef.current.delete(id);
      setTabs(prev => {
        const existing = prev[id];
        if (!existing) return prev;
        return {
          ...prev,
          [id]: { ...existing, content: freshContent, originalContent: freshContent, dirty: false }
        };
      });
    } catch {
      // Silently ignore – file may have been deleted by the same tool call
    }
  }, [tabs]);

  const saveTab = useCallback(async (id: string) => {
    const tab = tabs[id];
    if (!tab) return;
    setLoading(true);
    setError(null);
    try {
      await updateFile(tab.path, tab.content);
      // Clear dirty ref synchronously
      dirtyTabIdsRef.current.delete(id);
      setTabs(prev => ({
        ...prev,
        [id]: { ...prev[id], dirty: false }
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tabs]);

  // Wrapped in useCallback so activeTabId is never stale.
  // When activeTabId is null (no tab open), content changes are silently ignored
  // to prevent setting dirty state on a non-existent tab.
  const setContent = useCallback((content: string) => {
    if (activeTabId) {
      updateTabContent(activeTabId, content);
    }
  }, [activeTabId, updateTabContent]);

  const openFile = openTab; // backwards compat alias
  const currentContent = content;
  const setCurrentContent = setContent;

  const newFile = useCallback(async (parentPath: string, name: string) => {
    // Auto-append .html extension if not provided (targeted at story writers)
    const fileName = name.includes('.') ? name : `${name}.html`;
    const fullPath = parentPath ? `${parentPath}/${fileName}` : fileName;
    setError(null);
    try {
      await createFile(fullPath, '');
      if (pushUndo) {
        pushUndo({
          id: `newfile_${Date.now()}`,
          description: `Created ${fileName}`,
          undo: async () => { await deleteItem(fullPath); },
          redo: async () => { await createFile(fullPath, ''); },
        });
      }
      await loadFiles(parentPath);
      return fullPath;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [loadFiles, pushUndo]);

  const newFolder = useCallback(async (parentPath: string, name: string) => {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    setError(null);
    try {
      await createFolder(fullPath);
      if (pushUndo) {
        pushUndo({
          id: `newfolder_${Date.now()}`,
          description: `Created folder ${name}`,
          undo: async () => { await deleteItem(fullPath); },
          redo: async () => { await createFolder(fullPath); },
        });
      }
      await loadFiles(parentPath);
    } catch (err: any) {
      setError(err.message);
    }
  }, [loadFiles, pushUndo]);

  const deleteSelected = useCallback(async (path: string, parentPath = '') => {
    setError(null);
    try {
      // Capture content before delete for undo
      let fileContent = '';
      const fileName = path.split('/').pop() || path;
      try {
        fileContent = await getFileContent(path);
      } catch { /* not a file or already deleted */ }

      await deleteItem(path);
      if (pushUndo) {
        pushUndo({
          id: `delete_${Date.now()}`,
          description: `Deleted ${fileName}`,
          undo: async () => { await createFile(path, fileContent); },
          redo: async () => { await deleteItem(path); },
        });
      }
      // Close all tabs for this path
      setTabs(prev => {
        const newTabs = { ...prev };
        for (const [id, tab] of Object.entries(newTabs)) {
          if (tab.path === path) {
            delete newTabs[id];
            if (activeTabId === id) {
              const remainingIds = Object.keys(newTabs).filter(k => k !== id);
              setActiveTabId(remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null);
            }
          }
        }
        return newTabs;
      });
      await loadFiles(parentPath);
    } catch (err: any) {
      setError(err.message);
    }
  }, [activeTabId, loadFiles, pushUndo]);

  const renameSelected = useCallback(async (path: string, newName: string, parentPath = '') => {
    setError(null);
    try {
      const oldName = path.split('/').pop() || path;
      await renameItem(path, newName);
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      if (pushUndo) {
        pushUndo({
          id: `rename_${Date.now()}`,
          description: `Renamed ${oldName} to ${newName}`,
          undo: async () => { await renameItem(newPath, oldName); },
          redo: async () => { await renameItem(newPath, newName); },
        });
      }
      setTabs(prev => {
        const newTabs = { ...prev };
        for (const tab of Object.values(newTabs)) {
          if (tab.path === path) {
            tab.path = newPath;
            tab.name = newName;
          }
        }
        return newTabs;
      });
      await loadFiles(parentPath);
    } catch (err: any) {
      setError(err.message);
    }
  }, [loadFiles, pushUndo]);

  const copySelected = useCallback(async (path: string, parentPath = '') => {
    setError(null);
    try {
      const result = await copyFile(path);
      if (pushUndo) {
        pushUndo({
          id: `copy_${Date.now()}`,
          description: `Copied ${path.split('/').pop()}`,
          undo: async () => { await deleteItem(result.destPath); },
          redo: async () => { await copyFile(path, parentPath); },
        });
      }
      await loadFiles(parentPath);
    } catch (err: any) {
      setError(err.message);
    }
  }, [loadFiles, pushUndo]);

  const moveSelected = useCallback(async (path: string, parentPath = '') => {
    setError(null);
    try {
      let destFolder: string | null = null;
      if (showFolderPicker) {
        destFolder = await showFolderPicker(parentPath);
      } else {
        destFolder = prompt('Move to folder (leave empty for root):', parentPath);
      }
      if (destFolder === null) return; // user cancelled
      const fileName = path.split('/').pop() || path;
      const newPath = destFolder ? `${destFolder}/${fileName}` : fileName;
      await moveFile(path, destFolder);
      if (pushUndo) {
        pushUndo({
          id: `move_${Date.now()}`,
          description: `Moved ${fileName}`,
          undo: async () => {
            const undoDest = parentPath || '';
            await moveFile(newPath, undoDest);
          },
          redo: async () => { await moveFile(newPath, destFolder); },
        });
      }
      // Update tabs to reflect new path
      setTabs(prev => {
        const newTabs = { ...prev };
        for (const tab of Object.values(newTabs)) {
          if (tab.path === path) {
            tab.path = newPath;
            tab.name = fileName;
          }
        }
        return newTabs;
      });
      await loadFiles(parentPath);
      // Also reload destination folder if different from current
      if (destFolder && destFolder !== parentPath) {
        await loadFiles(destFolder);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [loadFiles, pushUndo]);

  // --- Batch operations ---

  const batchDelete = useCallback(async (paths: string[], parentPath = '') => {
    setError(null);
    const failures: string[] = [];
    for (const path of paths) {
      try {
        // Capture content before delete for undo
        let fileContent = '';
        const fileName = path.split('/').pop() || path;
        try {
          fileContent = await getFileContent(path);
        } catch { /* not a file or already deleted */ }

        await deleteItem(path);
        if (pushUndo) {
          pushUndo({
            id: `batchdelete_${Date.now()}_${fileName}`,
            description: `Deleted ${fileName}`,
            undo: async () => { await createFile(path, fileContent); },
            redo: async () => { await deleteItem(path); },
          });
        }
        // Close tabs for deleted path
        setTabs(prev => {
          const newTabs = { ...prev };
          for (const [id, tab] of Object.entries(newTabs)) {
            if (tab.path === path) {
              delete newTabs[id];
              if (activeTabId === id) {
                const remainingIds = Object.keys(newTabs).filter(k => k !== id);
                setActiveTabId(remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null);
              }
            }
          }
          return newTabs;
        });
      } catch (err: any) {
        failures.push(path + ': ' + err.message);
      }
    }
    await loadFiles(parentPath);
    if (failures.length > 0) {
      setError(`Failed to delete ${failures.length} item(s): ${failures.join('; ')}`);
    }
    return failures;
  }, [activeTabId, loadFiles, pushUndo]);

  const batchCopy = useCallback(async (paths: string[], destFolder: string, parentPath = '') => {
    setError(null);
    const failures: string[] = [];
    for (const path of paths) {
      try {
        await copyFile(path, destFolder);
      } catch (err: any) {
        failures.push(path + ': ' + err.message);
      }
    }
    await loadFiles(parentPath);
    if (destFolder && destFolder !== parentPath) {
      await loadFiles(destFolder);
    }
    if (failures.length > 0) {
      setError(`Failed to copy ${failures.length} item(s): ${failures.join('; ')}`);
    }
    return failures;
  }, [loadFiles]);

  const batchMove = useCallback(async (paths: string[], destFolder: string, parentPath = '') => {
    setError(null);
    const failures: string[] = [];
    for (const path of paths) {
      try {
        const fileName = path.split('/').pop() || path;
        const newPath = destFolder ? `${destFolder}/${fileName}` : fileName;
        await moveFile(path, destFolder);
        // Update tabs
        setTabs(prev => {
          const newTabs = { ...prev };
          for (const tab of Object.values(newTabs)) {
            if (tab.path === path) {
              tab.path = newPath;
              tab.name = fileName;
            }
          }
          return newTabs;
        });
      } catch (err: any) {
        failures.push(path + ': ' + err.message);
      }
    }
    await loadFiles(parentPath);
    if (destFolder && destFolder !== parentPath) {
      await loadFiles(destFolder);
    }
    if (failures.length > 0) {
      setError(`Failed to move ${failures.length} item(s): ${failures.join('; ')}`);
    }
    return failures;
  }, [loadFiles]);

  // Derive the parent folder of the active tab's file for image uploads
  const uploadImageFile = useCallback(async (file: File) => {
    setError(null);
    try {
      // Get the parent folder of the active tab's file
      const tabPath = activeTabId ? tabs[activeTabId]?.path : null;
      const folder = tabPath
        ? tabPath.substring(0, tabPath.lastIndexOf('/')) || ''
        : '';
      return await uploadImage(file, folder);
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [activeTabId, tabs]);

  // Upload a generic file to a specific workspace folder
  const uploadFileToFolder = useCallback(async (file: File, folderPath: string) => {
    setError(null);
    setLoading(true);
    try {
      const result = await uploadFile(file, folderPath);
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const closeOtherTabs = useCallback((keepId: string) => {
    setTabs(prev => {
      const newTabs: Record<string, Tab> = {};
      newTabs[keepId] = prev[keepId];
      return newTabs;
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs({});
    setActiveTabId(null);
  }, []);

  // Check if any tab is dirty
  const hasDirtyTabs = Object.values(tabs).some(t => t.dirty);

  return {
    files,
    currentPath,
    currentContent,
    content: currentContent,
    loading,
    error,
    setContent: setCurrentContent,
    tabs,
    activeTabId,
    loadFiles,
    openFile,
    openTab,
    saveCurrentFile: saveActiveTab,
    saveTab,
    restoreToOriginal,
    newFile,
    newFolder,
    deleteSelected,
    renameSelected,
    copySelected,
    moveSelected,
    uploadImageFile,
    uploadFileToFolder,
    closeTab,
    switchTab,
    updateTabContent,
    setTabBuildMetadata,
    dirtyTabIdsRef,
    closeOtherTabs,
    closeAllTabs,
    getMaxTabs,
    setMaxTabs,
    batchDelete,
    batchCopy,
    batchMove,
    reloadTab,
  };
}
