import { useState, useCallback, useRef } from 'react';

export interface FsOperation {
  id: string;
  description: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

// Use a mutable ref so the caller can set the refresh callback after hooks initialize.
// This avoids the circular dependency where useFiles needs pushUndo (from this hook)
// but this hook needs loadFiles (from useFiles).
export function useFileSystemUndoRedo() {
  const refreshRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const [undoStack, setUndoStack] = useState<FsOperation[]>([]);
  const [redoStack, setRedoStack] = useState<FsOperation[]>([]);

  const push = useCallback((operation: FsOperation) => {
    setUndoStack(prev => [...prev, operation]);
    setRedoStack([]); // clear redo stack on new operation
  }, []);

  const undo = useCallback(async () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const op = prev[prev.length - 1];
      const newUndo = prev.slice(0, -1);
      op.undo().finally(() => {
        setRedoStack(r => [...r, op]);
        if (refreshRef.current) refreshRef.current();
      });
      return newUndo;
    });
  }, []);

  const redo = useCallback(async () => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const op = prev[prev.length - 1];
      const newRedo = prev.slice(0, -1);
      op.redo().finally(() => {
        setUndoStack(u => [...u, op]);
        if (refreshRef.current) refreshRef.current();
      });
      return newRedo;
    });
  }, []);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undo,
    redo,
    push,
    clear,
    refreshRef,
  };
}