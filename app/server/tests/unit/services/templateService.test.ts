import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock fileService before importing templateService
vi.mock('../../../src/services/fileService.js', () => ({
  getSafePath: vi.fn((username: string, filePath: string) => {
    // Return a path under the temp workspace
    return path.join('/tmp/worbi-test-workspace', username, filePath);
  }),
  writeFile: vi.fn((username: string, filePath: string, content: string) => {
    const fullPath = path.join('/tmp/worbi-test-workspace', username, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }),
  readFile: vi.fn((username: string, filePath: string) => {
    const fullPath = path.join('/tmp/worbi-test-workspace', username, filePath);
    return fs.readFileSync(fullPath, 'utf-8');
  }),
}));

import {
  getAvailableTemplates,
  createFromTemplate,
  compileStoryBible,
} from '../../../src/services/templateService.js';

// Re-import the mocked fileService to verify calls
import * as fileService from '../../../src/services/fileService.js';

const testUser = 'template_test_user';
const workspaceDir = path.join('/tmp/worbi-test-workspace', testUser);

beforeEach(() => {
  vi.clearAllMocks();
  // Clean up workspace
  if (fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
  fs.mkdirSync(workspaceDir, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  // Clean up workspace
  if (fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
});

describe('templateService', () => {
  describe('getAvailableTemplates()', () => {
    it('returns all templates when no profile specified', () => {
      const templates = getAvailableTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('each template has required fields', () => {
      const templates = getAvailableTemplates();
      for (const t of templates) {
        expect(t).toHaveProperty('key');
        expect(t).toHaveProperty('label');
        expect(t).toHaveProperty('profile');
      }
    });

    it('filters to game templates when profile is "game"', () => {
      const templates = getAvailableTemplates('game' as any);
      const keys = templates.map((t) => t.key);
      expect(keys).toContain('playercharacter');
      expect(keys).toContain('quest');
      expect(keys).toContain('blank'); // shared
    });

    it('filters to work templates when profile is "work"', () => {
      const templates = getAvailableTemplates('work' as any);
      const keys = templates.map((t) => t.key);
      expect(keys).toContain('customer');
      expect(keys).toContain('job');
      expect(keys).toContain('blank'); // shared
    });

    it('game filter excludes work-only templates', () => {
      const templates = getAvailableTemplates('game' as any);
      const keys = templates.map((t) => t.key);
      expect(keys).not.toContain('customer');
      expect(keys).not.toContain('booking');
    });
  });

  describe('createFromTemplate()', () => {
    it('creates an HTML file from playercharacter template', () => {
      const result = createFromTemplate(testUser, 'playercharacter', 'Hero', 'NPCs');

      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('content');
      expect(result.path).toMatch(/\.html$/);
      expect(result.content).toContain('Character');
      expect(result.content).toContain('<!-- Build: Yes -->');
      expect(result.content).toContain('<!-- Template: Character -->');
    });

    it('creates a blank template file with export metadata', () => {
      const result = createFromTemplate(testUser, 'blank', 'MyDoc', '');

      expect(result.content).toContain('<!-- Build: Yes -->');
      expect(result.content).toContain('<!-- Template: Blank -->');
      expect(result.path).toMatch(/\.html$/);
    });

    it('adds Build metadata to work templates too', () => {
      const result = createFromTemplate(testUser, 'customer', 'Client', 'Customers');

      expect(result.content).toContain('<!-- Build: Yes -->');
      expect(result.content).toContain('<!-- Template: Customer -->');
      expect(result.content).toContain('<h2>Client</h2>');
    });

    it('throws for unknown template key', () => {
      expect(() => {
        createFromTemplate(testUser, 'nonexistent-template-xyz', 'Test', '');
      }).toThrow(/Unknown template/);
    });

    it('sanitizes name - removes invalid chars', () => {
      const result = createFromTemplate(testUser, 'blank', 'My/Bad:File*', '');

      expect(result.path).not.toContain('/');
      expect(result.path).not.toContain(':');
      expect(result.path).not.toContain('*');
    });

    it('creates file with unique name on conflict', () => {
      // Create the file first
      createFromTemplate(testUser, 'blank', 'MyDoc', '');
      // Create again - should get unique name
      const result2 = createFromTemplate(testUser, 'blank', 'MyDoc', '');

      expect(result2.path).not.toBe('MyDoc.html');
      expect(result2.path).toContain('MyDoc-2');
    });
  });

  describe('sanitizeName() via createFromTemplate', () => {
    it('removes backslashes and angle brackets', () => {
      const result = createFromTemplate(testUser, 'blank', 'Bad<Name>\\File', '');

      expect(result.path).not.toContain('\\');
      expect(result.path).not.toContain('<');
      expect(result.path).not.toContain('>');
    });

    it('handles name with only invalid chars', () => {
      // When name is only invalid chars, sanitizeName returns empty string
      // and createFromTemplate uses 'Untitled' as fallback
      const result = createFromTemplate(testUser, 'blank', '/:*?"<>|', '');

      expect(result.path).toContain('Untitled');
    });
  });

  describe('findUniqueFileName() via createFromTemplate', () => {
    it('returns original name when no conflict', () => {
      const result = createFromTemplate(testUser, 'blank', 'UniqueName', '');

      expect(result.path).toBe('UniqueName.html');
    });

    it('appends -2 for first duplicate', () => {
      createFromTemplate(testUser, 'blank', 'DupName', '');
      const result = createFromTemplate(testUser, 'blank', 'DupName', '');

      expect(result.path).toBe('DupName-2.html');
    });

    it('appends -3 for second duplicate', () => {
      createFromTemplate(testUser, 'blank', 'DupName', '');
      createFromTemplate(testUser, 'blank', 'DupName', '');
      const result = createFromTemplate(testUser, 'blank', 'DupName', '');

      expect(result.path).toBe('DupName-3.html');
    });
  });

  describe('compileStoryBible()', () => {
    beforeEach(() => {
      // Override getSafePath to return paths under our temp workspace
      vi.spyOn(fileService as any, 'getSafePath').mockImplementation(
        (user: any, fp: any) => {
          return path.join(workspaceDir, fp || '');
        }
      );
    });

    it('compiles multiple files into a single HTML document', () => {
      // Create test files
      fs.writeFileSync(path.join(workspaceDir, 'file1.html'), '<h2>Chapter One</h2><p>Content 1</p>', 'utf-8');
      fs.writeFileSync(path.join(workspaceDir, 'file2.html'), '<h2>Chapter Two</h2><p>Content 2</p>', 'utf-8');

      const html = compileStoryBible(testUser, {
        files: ['file1.html', 'file2.html'],
        title: 'Test Bible',
      });

      expect(html).toContain('Test Bible');
      expect(html).toContain('Chapter One');
      expect(html).toContain('Chapter Two');
    });

    it('includes table of contents when requested', () => {
      fs.writeFileSync(path.join(workspaceDir, 'doc1.html'), '<h2>Section A</h2>', 'utf-8');
      fs.writeFileSync(path.join(workspaceDir, 'doc2.html'), '<h2>Section B</h2>', 'utf-8');

      const html = compileStoryBible(testUser, {
        files: ['doc1.html', 'doc2.html'],
        includeTableOfContents: true,
      });

      expect(html).toContain('Table of Contents');
      expect(html).toContain('Section A');
      expect(html).toContain('Section B');
    });

    it('throws when no files to compile', () => {
      expect(() => {
        compileStoryBible(testUser, {
          files: [],
        });
      }).toThrow(/No files to compile/);
    });

    it('includes file paths when option is set', () => {
      fs.writeFileSync(path.join(workspaceDir, 'pathTest.html'), '<h2>PathDoc</h2>', 'utf-8');

      const html = compileStoryBible(testUser, {
        files: ['pathTest.html'],
        includeFilePaths: true,
      });

      expect(html).toContain('pathTest.html');
      expect(html).toContain('story-bible-path');
    });

    it('strips margin notes when excludeMarginNotes is true', () => {
      fs.writeFileSync(
        path.join(workspaceDir, 'marginTest.html'),
        '<h2>MarginDoc</h2><p>Main</p><!-- MARGIN_SPLIT --><p>Margin content</p>',
        'utf-8'
      );

      const html = compileStoryBible(testUser, {
        files: ['marginTest.html'],
        excludeMarginNotes: true,
      });

      expect(html).toContain('Main');
      expect(html).not.toContain('Margin content');
    });
  });

  describe('extractTitle() via compileStoryBible', () => {
    it('extracts title from h2 tag', () => {
      fs.writeFileSync(path.join(workspaceDir, 'h2test.html'), '<h2>My Title</h2><p>Body</p>', 'utf-8');

      const html = compileStoryBible(testUser, {
        files: ['h2test.html'],
        includeFilePaths: false,
      });

      // The ToC should contain the extracted title
      expect(html).toContain('My Title');
    });

    it('falls back to Untitled when no title found', () => {
      fs.writeFileSync(path.join(workspaceDir, 'notitle.html'), '<p>Just a paragraph</p>', 'utf-8');

      const html = compileStoryBible(testUser, {
        files: ['notitle.html'],
        includeTableOfContents: true,
      });

      expect(html).toContain('Untitled');
    });
  });

  describe('resolveWikiLinks() via compileStoryBible', () => {
    it('converts [[wiki links]] to plain text', () => {
      fs.writeFileSync(
        path.join(workspaceDir, 'wiki.html'),
        '<h2>WikiDoc</h2><p>See [[Important Quest]] for details</p>',
        'utf-8'
      );

      const html = compileStoryBible(testUser, {
        files: ['wiki.html'],
      });

      expect(html).toContain('Important Quest');
      expect(html).not.toContain('[[');
      expect(html).not.toContain(']]');
    });
  });
});
