import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFileSystemUndoRedo, FsOperation } from './useFileSystemUndoRedo';

function createMockOp(id: string): FsOperation {
  const undoFn = vi.fn().mockResolvedValue(undefined);
  const redoFn = vi.fn().mockResolvedValue(undefined);
  return {
    id,
    description: `Operation ${id}`,
    undo: undoFn,
    redo: redoFn,
  } as unknown as FsOperation;
}

describe('useFileSystemUndoRedo', () => {
  beforeEach(() => {});

  it('should start with empty stacks', () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('push should add to undo stack and clear redo', () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());

    act(() => {
      result.current.push(createMockOp('1'));
    });
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.push(createMockOp('2'));
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false); // redo cleared
  });

  it('undo should pop from undo stack', async () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());
    const op = createMockOp('1');

    act(() => {
      result.current.push(op);
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(op.undo).toHaveBeenCalled();
  });

  it('redo should pop from redo stack', async () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());
    const op = createMockOp('1');

    act(() => {
      result.current.push(op);
    });

    await act(async () => {
      await result.current.undo();
    });

    await act(async () => {
      await result.current.redo();
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
    expect(op.redo).toHaveBeenCalled();
  });

  it('cannot undo when stack empty', async () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());

    await act(async () => {
      await result.current.undo();
    });

    expect(result.current.canUndo).toBe(false);
  });

  it('cannot redo when stack empty', async () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());

    await act(async () => {
      await result.current.redo();
    });

    expect(result.current.canRedo).toBe(false);
  });

  it('push after undo clears redo stack', async () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());
    const op1 = createMockOp('1');
    const op2 = createMockOp('2');

    act(() => { result.current.push(op1); });
    act(() => { result.current.push(op2); });

    await act(async () => { await result.current.undo(); });
    expect(result.current.canRedo).toBe(true);

    act(() => { result.current.push(createMockOp('3')); });
    expect(result.current.canRedo).toBe(false);
  });

  it('multiple ops undone in reverse order', async () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());
    const op1 = createMockOp('1');
    const op2 = createMockOp('2');
    const op3 = createMockOp('3');

    act(() => { result.current.push(op1); });
    act(() => { result.current.push(op2); });
    act(() => { result.current.push(op3); });

    await act(async () => { await result.current.undo(); });
    expect(op3.undo).toHaveBeenCalled();
    expect(op2.undo).not.toHaveBeenCalled();
    expect(op1.undo).not.toHaveBeenCalled();
  });

  it('clear should empty both stacks', () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());

    act(() => { result.current.push(createMockOp('1')); });
    act(() => { result.current.push(createMockOp('2')); });

    act(() => { result.current.clear(); });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('refreshRef is called after undo', async () => {
    const { result } = renderHook(() => useFileSystemUndoRedo());
    const refreshFn = vi.fn().mockResolvedValue(undefined);
    result.current.refreshRef.current = refreshFn;
    const op = createMockOp('1');

    act(() => { result.current.push(op); });

    await act(async () => { await result.current.undo(); });

    expect(refreshFn).toHaveBeenCalled();
  });
});