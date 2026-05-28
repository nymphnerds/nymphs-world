/**
 * useFiles hook tests
 *
 * Focus: reloadTab(), dirty tracking, and tab operations.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FileItem } from '../services/api';

// Mock the API before importing the hook
vi.mock('../services/api', () => ({
  listFiles: vi.fn(),
  getFileContent: vi.fn(),
  createFile: vi.fn(),
  createFolder: vi.fn(),
  updateFile: vi.fn(),
  deleteItem: vi.fn(),
  renameItem: vi.fn(),
  copyFile: vi.fn(),
  moveFile: vi.fn(),
  uploadImage: vi.fn(),
  uploadFile: vi.fn(),
}));

import * as api from '../services/api';
const mockGetFileContent = api.getFileContent as ReturnType<typeof vi.fn>;
const mockListFiles = api.listFiles as ReturnType<typeof vi.fn>;
const mockUpdateFile = api.updateFile as ReturnType<typeof vi.fn>;

import { useFiles } from './useFiles';

describe('useFiles — reloadTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFileContent.mockReset();
    mockListFiles.mockResolvedValue([] as FileItem[]);
  });

  it('reloads a clean tab from the server', async () => {
    mockGetFileContent.mockResolvedValueOnce('<p>original</p>');
    mockGetFileContent.mockResolvedValueOnce('<p>updated by LLM</p>');

    const { result } = renderHook(() => useFiles());

    // Open a file (creates a tab)
    let tabId: string | undefined;
    await act(async () => {
      const res = await result.current.openTab('test.html');
      if (res) tabId = res.id;
    });

    expect(tabId).toBeDefined();
    expect(result.current.tabs[tabId!].content).toBe('<p>original</p>');

    // Reload the tab
    await act(async () => {
      await result.current.reloadTab(tabId!);
    });

    expect(result.current.tabs[tabId!].content).toBe('<p>updated by LLM</p>');
    expect(result.current.tabs[tabId!].originalContent).toBe('<p>updated by LLM</p>');
    expect(result.current.tabs[tabId!].dirty).toBe(false);
    expect(mockGetFileContent).toHaveBeenCalledTimes(2);
  });

  it('does NOT reload a dirty tab (skips unsaved edits)', async () => {
    mockGetFileContent.mockResolvedValueOnce('<p>original</p>');

    const { result } = renderHook(() => useFiles());

    let tabId: string | undefined;
    await act(async () => {
      const res = await result.current.openTab('test.html');
      if (res) tabId = res.id;
    });

    // Make the tab dirty
    await act(async () => {
      result.current.updateTabContent(tabId!, '<p>local edit</p>');
    });

    expect(result.current.tabs[tabId!].dirty).toBe(true);

    // Mock a different server response
    mockGetFileContent.mockResolvedValueOnce('<p>server version</p>');

    // Attempt reload
    await act(async () => {
      await result.current.reloadTab(tabId!);
    });

    // Content should NOT have changed (dirty tabs are skipped)
    expect(result.current.tabs[tabId!].content).toBe('<p>local edit</p>');
    // reloadTab was called but should have returned early, so getFileContent was NOT called
    expect(mockGetFileContent).toHaveBeenCalledTimes(1);
  });

  it('does nothing for non-existent tab id', async () => {
    mockGetFileContent.mockResolvedValueOnce('content');

    const { result } = renderHook(() => useFiles());

    // Should not throw
    await act(async () => {
      await result.current.reloadTab('non-existent-tab-id');
    });

    expect(mockGetFileContent).not.toHaveBeenCalled();
  });

  it('silently ignores file fetch errors', async () => {
    mockGetFileContent.mockResolvedValueOnce('<p>original</p>');
    mockGetFileContent.mockRejectedValueOnce(new Error('File not found'));

    const { result } = renderHook(() => useFiles());

    let tabId: string | undefined;
    await act(async () => {
      const res = await result.current.openTab('test.html');
      if (res) tabId = res.id;
    });

    // reloadTab should NOT throw even if getFileContent fails
    await act(async () => {
      await result.current.reloadTab(tabId!);
    });

    // Tab content should be unchanged after failed reload
    expect(result.current.tabs[tabId!].content).toBe('<p>original</p>');
  });

  it('clears dirty state on successful reload', async () => {
    mockGetFileContent.mockResolvedValueOnce('<p>v1</p>');
    mockGetFileContent.mockResolvedValueOnce('<p>v2</p>');

    const { result } = renderHook(() => useFiles());

    let tabId: string | undefined;
    await act(async () => {
      const res = await result.current.openTab('test.html');
      if (res) tabId = res.id;
    });

    expect(result.current.tabs[tabId!].dirty).toBe(false);

    await act(async () => {
      await result.current.reloadTab(tabId!);
    });

    expect(result.current.tabs[tabId!].dirty).toBe(false);
    expect(result.current.dirtyTabIdsRef.current.has(tabId!)).toBe(false);
  });
});

describe('useFiles — dirty tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFileContent.mockReset().mockResolvedValue('<p>content</p>');
    mockListFiles.mockResolvedValue([] as FileItem[]);
  });

  it('marks tab dirty when content is updated', async () => {
    const { result } = renderHook(() => useFiles());

    let tabId: string | undefined;
    await act(async () => {
      const res = await result.current.openTab('test.html');
      if (res) tabId = res.id;
    });

    expect(result.current.tabs[tabId!].dirty).toBe(false);
    expect(result.current.dirtyTabIdsRef.current.has(tabId!)).toBe(false);

    await act(async () => {
      result.current.updateTabContent(tabId!, '<p>edited</p>');
    });

    expect(result.current.tabs[tabId!].dirty).toBe(true);
    expect(result.current.dirtyTabIdsRef.current.has(tabId!)).toBe(true);
  });

  it('clears dirty state after save', async () => {
    mockUpdateFile.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFiles());

    let tabId: string | undefined;
    await act(async () => {
      const res = await result.current.openTab('test.html');
      if (res) tabId = res.id;
    });

    // Make dirty
    await act(async () => {
      result.current.updateTabContent(tabId!, '<p>edited</p>');
    });
    expect(result.current.tabs[tabId!].dirty).toBe(true);

    // Save
    await act(async () => {
      await result.current.saveTab(tabId!);
    });

    expect(result.current.tabs[tabId!].dirty).toBe(false);
    expect(result.current.dirtyTabIdsRef.current.has(tabId!)).toBe(false);
  });

  it('clears dirty state on restoreToOriginal', async () => {
    const { result } = renderHook(() => useFiles());

    let tabId: string | undefined;
    await act(async () => {
      const res = await result.current.openTab('test.html');
      if (res) tabId = res.id;
    });

    await act(async () => {
      result.current.updateTabContent(tabId!, '<p>edited</p>');
    });
    expect(result.current.tabs[tabId!].dirty).toBe(true);

    await act(async () => {
      result.current.restoreToOriginal(tabId!);
    });

    expect(result.current.tabs[tabId!].dirty).toBe(false);
    expect(result.current.tabs[tabId!].content).toBe('<p>content</p>');
  });
});

describe('useFiles — tab operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFileContent.mockReset().mockResolvedValue('<p>content</p>');
    mockListFiles.mockResolvedValue([] as FileItem[]);
  });

  it('opens a file in a new tab', async () => {
    const { result } = renderHook(() => useFiles());

    let res: { content: string; id: string } | null = null;
    await act(async () => {
      res = await result.current.openTab('myFile.html');
    });

    expect(res).not.toBeNull();
    expect(res!.content).toBe('<p>content</p>');
    expect(result.current.activeTabId).toBe(res!.id);
    expect(result.current.tabs[res!.id].name).toBe('myFile');
  });

  it('switches active tab without creating new tab', async () => {
    const { result } = renderHook(() => useFiles());

    let tab1Id: string | undefined, tab2Id: string | undefined;
    await act(async () => {
      const r1 = await result.current.openTab('file1.html');
      const r2 = await result.current.openTab('file2.html');
      if (r1) tab1Id = r1.id;
      if (r2) tab2Id = r2.id;
    });

    expect(result.current.activeTabId).toBe(tab2Id);

    await act(async () => {
      result.current.switchTab(tab1Id!);
    });

    expect(result.current.activeTabId).toBe(tab1Id);
  });

  it('closes a tab and activates the last open tab', async () => {
    const { result } = renderHook(() => useFiles());

    let tab1Id: string | undefined;
    let tab2Id: string | undefined;
    await act(async () => {
      const r1 = await result.current.openTab('file1.html');
      const r2 = await result.current.openTab('file2.html');
      if (r1) tab1Id = r1.id;
      if (r2) tab2Id = r2.id;
    });

    await act(async () => {
      result.current.closeTab(tab1Id!);
    });

    expect(result.current.activeTabId).toBe(tab2Id);
    expect(result.current.tabs[tab1Id!]).toBeUndefined();
  });
});