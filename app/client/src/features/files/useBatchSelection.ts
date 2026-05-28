import { useState, useCallback } from 'react';
import type { FileItem } from '../../services/api';

export function useBatchSelection(
  explorerPath: string,
  batchDelete: (paths: string[], folder: string) => void,
  batchCopy: (paths: string[], dest: string, source: string) => void,
  batchMove: (paths: string[], dest: string, source: string) => void,
  showConfirm: (title: string, msg: string, label: string, variant: string, cb: () => void) => void,
  showFolderPicker: (defaultFolder?: string) => Promise<string | null>,
) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        setSelectedPaths(new Set());
      }
      return !prev;
    });
  }, []);

  const handleToggleSelect = useCallback((path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((items: FileItem[]) => {
    setSelectedPaths(new Set(items.map(f => f.path)));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const handleBatchDelete = useCallback((paths: string[]) => {
    const warningMsg = `Delete ${paths.length} selected item(s)? This cannot be undone.`;
    showConfirm('Batch Delete', warningMsg, 'Delete', 'danger', () => {
      batchDelete(paths, explorerPath);
      setSelectedPaths(new Set());
      setSelectionMode(false);
    });
  }, [batchDelete, explorerPath, showConfirm]);

  const handleBatchCopy = useCallback(async (paths: string[]) => {
    const destFolder = await showFolderPicker(explorerPath);
    if (destFolder === null) return;
    batchCopy(paths, destFolder, explorerPath);
    setSelectedPaths(new Set());
    setSelectionMode(false);
  }, [explorerPath, showFolderPicker, batchCopy]);

  const handleBatchMove = useCallback(async (paths: string[]) => {
    const destFolder = await showFolderPicker(explorerPath);
    if (destFolder === null) return;
    batchMove(paths, destFolder, explorerPath);
    setSelectedPaths(new Set());
    setSelectionMode(false);
  }, [explorerPath, showFolderPicker, batchMove]);

  return {
    selectionMode,
    setSelectionMode,
    selectedPaths,
    setSelectedPaths,
    handleToggleSelectionMode,
    handleToggleSelect,
    handleSelectAll,
    handleClearSelection,
    handleBatchDelete,
    handleBatchCopy,
    handleBatchMove,
  };
}