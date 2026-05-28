/**
 * toolService unit tests
 *
 * Tests executeTool and getToolDefinitions by mocking fileService.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock fileService ──
vi.mock('../../../src/services/fileService.js', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  listDirectory: vi.fn(),
  deleteItem: vi.fn(),
  renameItem: vi.fn(),
  createFolder: vi.fn(),
  searchWorkspace: vi.fn(),
  copyItem: vi.fn(),
  moveItem: vi.fn(),
}));

// ── Mock other services ──
vi.mock('../../../src/services/graphService.js', () => ({}));
vi.mock('../../../src/services/tagService.js', () => ({}));
vi.mock('../../../src/services/locationService.js', () => ({}));
vi.mock('../../../src/services/reminderService.js', () => ({}));

vi.mock('axios', () => {
  const mockGet = vi.fn();
  return {
    default: { get: mockGet },
    get: mockGet,
  };
});

import axios from 'axios';
import * as toolService from '../../../src/services/toolService.js';
import * as fileService from '../../../src/services/fileService.js';

const TEST_USER = 'testuser';

// ── Tests ──

describe('toolService', () => {
  // ── web_search (mock axios) ──

  describe('web_search via executeTool()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (axios.get as any).mockResolvedValue({
        data: `<html><div><a href="https://example.com" class="result__a">Example</a>` +
          `<div class="result-snippet">A test result</div></div></html>`,
      });
    });

    it('returns formatted search results', async () => {
      const result = await toolService.executeTool('web_search', { query: 'test' });
      expect(typeof result).toBe('string');
      expect(result).toContain('Search Results');
    });
  });

  // ── read_file ──

  describe('read_file', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns file content', async () => {
      (fileService.readFile as any).mockReturnValue('Hello World');

      const result = await toolService.executeTool('read_file', {
        file_path: '__test__/hello.txt',
      }, TEST_USER);

      expect(fileService.readFile).toHaveBeenCalledWith(TEST_USER, '__test__/hello.txt');
      expect(result).toContain('Hello World');
    });

    it('throws for non-existent file', async () => {
      (fileService.readFile as any).mockImplementation(() => {
        throw new Error('File not found: ghost.txt');
      });

      await expect(
        toolService.executeTool('read_file', { file_path: '__test__/nope.txt' }, TEST_USER)
      ).rejects.toThrow(/not found/i);
    });

    it('throws without authentication', async () => {
      await expect(
        toolService.executeTool('read_file', { file_path: 'hello.txt' })
      ).rejects.toThrow(/requires authentication/i);
    });
  });

  // ── list_directory ──

  describe('list_directory', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns formatted directory listing', async () => {
      (fileService.listDirectory as any).mockReturnValue([
        { name: 'a.txt', type: 'file', size: 100 },
        { name: 'b.txt', type: 'file', size: 200 },
      ]);

      const result = await toolService.executeTool('list_directory', {
        dir_path: '__test__',
      }, TEST_USER);

      expect(fileService.listDirectory).toHaveBeenCalledWith(TEST_USER, '__test__');
      expect(result).toContain('a.txt');
      expect(result).toContain('b.txt');
    });

    it('returns workspace root listing with empty path', async () => {
      (fileService.listDirectory as any).mockReturnValue([
        { name: 'README.md', type: 'file', size: 500 },
      ]);

      const result = await toolService.executeTool('list_directory', {
        dir_path: '',
      }, TEST_USER);

      expect(typeof result).toBe('string');
      expect(result).toContain('Directory listing');
    });

    it('throws for non-existent directory', async () => {
      (fileService.listDirectory as any).mockImplementation(() => {
        throw new Error('Directory not found');
      });

      await expect(
        toolService.executeTool('list_directory', { dir_path: '__test__/nonexistent' }, TEST_USER)
      ).rejects.toThrow(/not found/i);
    });
  });

  // ── write_file ──

  describe('write_file', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates a new file', async () => {
      (fileService.writeFile as any).mockReturnValue(undefined);

      const result = await toolService.executeTool('write_file', {
        file_path: '__test__/new.txt',
        content: 'written content',
      }, TEST_USER);

      expect(fileService.writeFile).toHaveBeenCalledWith(TEST_USER, '__test__/new.txt', 'written content');
      expect(typeof result).toBe('string');
      expect(result).toContain('created');
    });

    it('throws without content', async () => {
      await expect(
        toolService.executeTool('write_file', { file_path: '__test__/x.txt' }, TEST_USER)
      ).rejects.toThrow(/requires.*content/i);
    });
  });

  // ── edit_file ──

  describe('edit_file', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('replaces text in file using search/replace mode', async () => {
      (fileService.readFile as any).mockReturnValue('line one\nline two\nline three');
      (fileService.writeFile as any).mockReturnValue(undefined);

      const result = await toolService.executeTool('edit_file', {
        file_path: '__test__/edit.txt',
        search_text: 'line two',
        replace_text: 'modified',
      }, TEST_USER);

      expect(fileService.readFile).toHaveBeenCalledWith(TEST_USER, '__test__/edit.txt');
      expect(fileService.writeFile).toHaveBeenCalledWith(TEST_USER, '__test__/edit.txt', 'line one\nmodified\nline three');
      expect(result).toContain('updated');
    });

    it('overwrites entire content when content provided', async () => {
      (fileService.writeFile as any).mockReturnValue(undefined);

      const result = await toolService.executeTool('edit_file', {
        file_path: '__test__/edit.txt',
        content: 'full new content',
      }, TEST_USER);

      expect(fileService.writeFile).toHaveBeenCalledWith(TEST_USER, '__test__/edit.txt', 'full new content');
      expect(result).toContain('updated');
    });

    it('throws without authentication', async () => {
      await expect(
        toolService.executeTool('edit_file', { file_path: 'x.txt', content: 'y' })
      ).rejects.toThrow(/requires authentication/i);
    });
  });

  // ── create_folder ──

  describe('create_folder', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates a new folder', async () => {
      (fileService.createFolder as any).mockReturnValue(undefined);

      const result = await toolService.executeTool('create_folder', {
        folder_path: '__test__/newfolder',
      }, TEST_USER);

      expect(fileService.createFolder).toHaveBeenCalledWith(TEST_USER, '__test__/newfolder');
      expect(result).toContain('created');
    });
  });

  // ── delete_file ──

  describe('delete_file', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('deletes a file', async () => {
      (fileService.deleteItem as any).mockReturnValue(undefined);

      const result = await toolService.executeTool('delete_file', {
        file_path: '__test__/deleteme.txt',
      }, TEST_USER);

      expect(fileService.deleteItem).toHaveBeenCalledWith(TEST_USER, '__test__/deleteme.txt');
      expect(result).toContain('Deleted');
    });

    it('throws for non-existent file', async () => {
      (fileService.deleteItem as any).mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(
        toolService.executeTool('delete_file', { file_path: '__test__/ghost.txt' }, TEST_USER)
      ).rejects.toThrow(/not found/i);
    });
  });

  // ── rename_file ──

  describe('rename_file', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renames a file', async () => {
      (fileService.renameItem as any).mockReturnValue(undefined);

      const result = await toolService.executeTool('rename_file', {
        file_path: '__test__/oldname.txt',
        new_name: 'newname.txt',
      }, TEST_USER);

      expect(fileService.renameItem).toHaveBeenCalledWith(TEST_USER, '__test__/oldname.txt', 'newname.txt');
      expect(result).toContain('Renamed');
    });

    it('throws for non-existent file', async () => {
      (fileService.renameItem as any).mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(
        toolService.executeTool('rename_file', {
          file_path: '__test__/ghost.txt',
          new_name: 'x.txt',
        }, TEST_USER)
      ).rejects.toThrow(/not found/i);
    });

    it('throws for directories', async () => {
      (fileService.renameItem as any).mockImplementation(() => {
        throw new Error('Cannot rename a directory');
      });

      await expect(
        toolService.executeTool('rename_file', {
          file_path: '__test__/adir',
          new_name: 'newdir',
        }, TEST_USER)
      ).rejects.toThrow(/directory/i);
    });
  });

  // ── Unknown tool ──

  describe('unknown tool', () => {
    it('throws for unknown tool name', async () => {
      await expect(
        toolService.executeTool('nonexistent_tool', {})
      ).rejects.toThrow(/Unknown tool/i);
    });
  });

  // ── getToolDefinitions permission gating ──

  describe('getToolDefinitions()', () => {
    function getToolNames(permissions: any) {
      const defs = toolService.getToolDefinitions(permissions);
      return defs.map((d: any) => d.function.name);
    }

    it('webSearch + fileAccessLevel read -> web_search, read_file, list_directory', () => {
      const names = getToolNames({ webSearch: true, fileAccessLevel: 'read', allowFiles: true });
      expect(names).toContain('web_search');
      expect(names).toContain('read_file');
      expect(names).toContain('list_directory');
      expect(names).not.toContain('write_file');
      expect(names).not.toContain('delete_file');
    });

    it('fileAccessLevel readwrite + allowCreate + allowEdit -> read+write+create+edit', () => {
      const names = getToolNames({
        webSearch: false,
        fileAccessLevel: 'readwrite',
        allowCreate: true,
        allowEdit: true,
        allowFiles: true,
      });
      expect(names).not.toContain('web_search');
      expect(names).toContain('read_file');
      expect(names).toContain('write_file');
      expect(names).toContain('edit_file');
      expect(names).toContain('create_folder');
      expect(names).not.toContain('delete_file');
      expect(names).not.toContain('rename_file');
    });

    it('fileAccessLevel full + all allows -> all file tools', () => {
      const names = getToolNames({
        webSearch: true,
        fileAccessLevel: 'full',
        allowCreate: true,
        allowEdit: true,
        allowDelete: true,
        allowRename: true,
        allowFiles: true,
      });
      expect(names).toContain('web_search');
      expect(names).toContain('read_file');
      expect(names).toContain('list_directory');
      expect(names).toContain('write_file');
      expect(names).toContain('edit_file');
      expect(names).toContain('create_folder');
      expect(names).toContain('delete_file');
      expect(names).toContain('rename_file');
    });

    it('fileAccessLevel none -> no file tools (or web_search only if enabled)', () => {
      const names = getToolNames({ fileAccessLevel: 'none' });
      expect(names).toEqual([]);
    });

    it('fileAccessLevel none + webSearch -> only web_search', () => {
      const names = getToolNames({ fileAccessLevel: 'none', webSearch: true });
      expect(names).toEqual(['web_search']);
    });

    it('no permissions -> empty array', () => {
      const names = getToolNames({});
      expect(names).toEqual([]);
    });

    it('fileAccessLevel readwrite -> read + write + create tools (no delete/rename)', () => {
      const names = getToolNames({ fileAccessLevel: 'readwrite', allowFiles: true });
      expect(names).toContain('read_file');
      expect(names).toContain('list_directory');
      expect(names).toContain('write_file');
      expect(names).toContain('create_folder');
      expect(names).not.toContain('delete_file');
      expect(names).not.toContain('rename_file');
    });

    it('allowRead/allowWrite granular perms emit new-style names', () => {
      const names = getToolNames({
        allowFiles: true,
        allowRead: true,
        allowWrite: true,
        allowDelete: true,
        allowRename: true,
      });
      expect(names).toContain('read');
      expect(names).toContain('list');
      expect(names).toContain('write');
      expect(names).toContain('edit');
      expect(names).toContain('delete');
      expect(names).toContain('rename');
    });
  });
});