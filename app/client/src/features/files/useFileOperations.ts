import { useState, useCallback, useEffect } from 'react';
import { useFiles } from '../../hooks/useFiles';
import { useFileSystemUndoRedo } from '../../hooks/useFileSystemUndoRedo';
import type { FileItem } from '../../services/api';
import { createFile, updateFile } from '../../services/api';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico']);

export function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

export function isDocxFile(name: string): boolean {
  return name.toLowerCase().endsWith('.docx');
}

export function useFileOperations(
  showFolderPicker: (defaultFolder?: string, disableRoot?: boolean) => Promise<string>,
) {
  const [explorerPath, setExplorerPath] = useState('');

  const fileUndoRedo = useFileSystemUndoRedo();
  const { canUndo, canRedo, undo: undoFs, redo: redoFs, push: pushUndoOp, refreshRef } = fileUndoRedo;

  const {
    files,
    currentPath,
    content,
    loading,
    error,
    setContent,
    tabs,
    activeTabId,
    loadFiles,
    openFile,
    openTab,
    saveCurrentFile,
    saveTab,
    restoreToOriginal,
    newFile: newFileRaw,
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
    batchDelete,
    batchCopy,
    batchMove,
    reloadTab,
  } = useFiles(pushUndoOp, showFolderPicker);

  // Wire up the refresh callback so undo/redo can reload the file list
  useEffect(() => {
    refreshRef.current = () => loadFiles(explorerPath);
  }, [loadFiles, explorerPath, refreshRef]);

  const handleNewFile = useCallback((name: string) => {
    newFileRaw(explorerPath, name);
  }, [explorerPath, newFileRaw]);

  const handleDelete = useCallback((item: FileItem) => {
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '';
    deleteSelected(item.path, parentPath);
  }, [deleteSelected]);

  const handleRename = useCallback((item: FileItem, newName: string) => {
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '';
    renameSelected(item.path, newName, parentPath);
  }, [renameSelected]);

  const handleCopy = useCallback((item: FileItem) => {
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '';
    copySelected(item.path, parentPath);
  }, [copySelected]);

  const handleMove = useCallback((item: FileItem) => {
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '';
    moveSelected(item.path, parentPath);
  }, [moveSelected]);

  const handleBack = useCallback(() => {
    const parts = explorerPath.split('/');
    parts.pop();
    const newPath = parts.join('/') || '';
    setExplorerPath(newPath);
    loadFiles(newPath);
  }, [explorerPath, loadFiles]);

  const handleBackToRoot = useCallback(() => {
    setExplorerPath('');
    loadFiles('');
  }, [loadFiles]);

  const handleBackToSegment = useCallback((path: string) => {
    setExplorerPath(path);
    loadFiles(path);
  }, [loadFiles]);

  const handleNewFolder = useCallback(() => {
    const name = prompt('Enter folder name:');
    if (!name || !name.trim()) return;
    newFolder(explorerPath, name.trim());
  }, [explorerPath, newFolder]);

  const createFileWithContent = useCallback(
    async (folder: string, name: string, content: string): Promise<string | null> => {
      const created = await newFileRaw(folder, name);
      if (!created) return null;
      await updateFile(created, content);
      return created;
    },
    [newFileRaw],
  );

  const handleUploadFiles = useCallback(async (fileList: FileList) => {
    let targetFolder = explorerPath;

    if (!targetFolder) {
      const folders = files.filter(f => f.type === 'folder').map(f => f.name);
      if (folders.length === 0) {
        alert('No folders available. Please create a folder first.');
        return;
      }
      const folderList = folders.map((f, i) => `${i + 1}. ${f}`).join('\n');
      const selection = prompt(
        `Select a folder for the upload:\n${folderList}\n\nEnter folder number (or type a new folder name to create):`
      );
      if (!selection) return;

      const idx = parseInt(selection, 10) - 1;
      if (idx >= 0 && idx < folders.length) {
        targetFolder = folders[idx];
      } else {
        const trimmed = selection.trim();
        if (!trimmed) return;
        await newFolder('', trimmed);
        targetFolder = trimmed;
      }
    }

    for (const file of Array.from(fileList)) {
      if (isDocxFile(file.name)) {
        try {
          // @ts-ignore - mammoth.browser has no types
          const mammothModule = await import('mammoth/mammoth.browser');
          const mammoth: any = mammothModule.default;
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });

          const baseName = file.name.replace(/\.docx$/i, '');
          const htmlPath = await newFileRaw(targetFolder, `${baseName}.html`);
          if (htmlPath) {
            await updateFile(htmlPath, result.value);
          }
          if (result.messages.length > 0) console.warn('[v4.12] DOCX upload warnings:', result.messages);
        } catch (err) {
          alert(`DOCX import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        continue;
      }
      await uploadFileToFolder(file, targetFolder);
    }
    loadFiles(targetFolder);
  }, [explorerPath, files, uploadFileToFolder, loadFiles, newFileRaw, newFolder]);

  return {
    files,
    currentPath,
    content,
    loading,
    error,
    setContent,
    tabs,
    activeTabId,
    loadFiles,
    openFile,
    openTab,
    saveCurrentFile,
    saveTab,
    restoreToOriginal,
    newFile: newFileRaw,
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
    closeOtherTabs,
    closeAllTabs,
    dirtyTabIdsRef,
    batchDelete,
    batchCopy,
    batchMove,
    canUndo,
    canRedo,
    undoFs,
    redoFs,
    explorerPath,
    setExplorerPath,
    handleNewFile,
    handleDelete,
    handleRename,
    handleCopy,
    handleMove,
    handleBack,
    handleBackToRoot,
    handleBackToSegment,
    handleNewFolder,
    handleUploadFiles,
    createFileWithContent,
    reloadTab,
  };
}
