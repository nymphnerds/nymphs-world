import { describe, it, expect, beforeEach, afterEach, vi, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// Fixed temp path so the vi.mock factory (which is hoisted) can reference it.
const TEMP_ROOT = '/tmp/worbi-tag-unit-test';
const MOCK_HOME = path.join(TEMP_ROOT, 'home');
const MOCK_WORKSPACE = path.join(TEMP_ROOT, 'workspace');

// vi.mock is hoisted before top-level const/let, so we use string literals
// that match the constants defined above.
vi.mock('os', () => ({
  default: {
    homedir: () => '/tmp/worbi-tag-unit-test/home',
    tmpdir: () => '/tmp',
    platform: () => 'linux',
    type: () => 'Linux',
    release: () => '6.6',
    hostname: () => 'test',
    userInfo: () => ({ uid: 1000, gid: 1000, username: 'test' }),
    networkInterfaces: () => ({}),
    cpus: () => [],
    freemem: () => 8e9,
    totalmem: () => 16e9,
    uptime: () => 1000,
    arch: () => 'x64',
    endian: () => 'LE',
  },
}));

vi.mock('../../../src/services/authService.js', () => ({
  getUserWorkspaceDir: () => '/tmp/worbi-tag-unit-test/workspace',
}));

import * as tagService from '../../../src/services/tagService.js';

// Now create the dirs after imports are done
fs.mkdirSync(MOCK_HOME, { recursive: true });
fs.mkdirSync(MOCK_WORKSPACE, { recursive: true });

describe('tagService (with temp data dirs)', () => {
  beforeEach(() => {
    // Write empty tag registry so each test starts clean
    const tagsDir = path.join(MOCK_HOME, '.wbu');
    fs.mkdirSync(tagsDir, { recursive: true });
    const tagsFile = path.join(tagsDir, 'tags.json');
    fs.writeFileSync(tagsFile, JSON.stringify({ tags: [] }, null, 2));
    // Clean up workspace meta files
    const metaFiles = fs.readdirSync(MOCK_WORKSPACE).filter(f => f.includes('.wbu_meta'));
    metaFiles.forEach(f => fs.rmSync(path.join(MOCK_WORKSPACE, f), { force: true }));
  });

  afterEach(() => {
    const files = fs.readdirSync(MOCK_WORKSPACE);
    for (const f of files) {
      fs.rmSync(path.join(MOCK_WORKSPACE, f), { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEMP_ROOT)) {
      fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
    }
  });

  // ── getAllTags ──

  describe('getAllTags()', () => {
    it('returns an array', () => {
      const tags = tagService.getAllTags();
      expect(Array.isArray(tags)).toBe(true);
    });

    it('returns empty array when no tags exist', () => {
      const tags = tagService.getAllTags();
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBe(0);
    });

    it('returns tag metadata after creating one', () => {
      const tag = tagService.createTag('MetaTag', '#abc');
      const tags = tagService.getAllTags();
      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0]).toHaveProperty('id');
      expect(tags[0]).toHaveProperty('name');
      expect(tags[0]).toHaveProperty('color');
    });
  });

  // ── createTag ──

  describe('createTag()', () => {
    it('creates tag with name and color', () => {
      const tag = tagService.createTag('Villain', '#ff0000');
      expect(tag.name).toBe('Villain');
      expect(tag.color).toBe('#ff0000');
      expect(tag.id).toBeDefined();
      expect(tag.description).toBe('');
    });

    it('creates tag with name, color, and description', () => {
      const tag = tagService.createTag('Hero', '#00ff00', 'The protagonist');
      expect(tag.name).toBe('Hero');
      expect(tag.color).toBe('#00ff00');
      expect(tag.description).toBe('The protagonist');
    });

    it('uses default purple color when color not provided', () => {
      const tag = tagService.createTag('Mysterious');
      expect(tag.color).toBe('#a78bfa');
    });

    it('throws for missing name', () => {
      expect(() => tagService.createTag('', '#000')).toThrow(/required/i);
    });

    it('throws for duplicate name', () => {
      tagService.createTag('Unique', '#123');
      expect(() => tagService.createTag('Unique', '#456')).toThrow(/already exists/i);
    });

    it('tag is case-insensitive for duplicates', () => {
      tagService.createTag('MyTag', '#123');
      expect(() => tagService.createTag('mytag', '#456')).toThrow(/already exists/i);
    });

    it('new tag appears in getAllTags', () => {
      const countBefore = tagService.getAllTags().length;
      tagService.createTag('NewVisible', '#abc');
      const countAfter = tagService.getAllTags().length;
      expect(countAfter).toBe(countBefore + 1);
    });
  });

  // ── updateTag ──

  describe('updateTag()', () => {
    it('updates name', () => {
      const tag = tagService.createTag('OldName', '#111');
      const updated = tagService.updateTag(tag.id, { name: 'NewName' });
      expect(updated.name).toBe('NewName');
    });

    it('updates color', () => {
      const tag = tagService.createTag('ColorTag', '#111');
      const updated = tagService.updateTag(tag.id, { color: '#ff0000' });
      expect(updated.color).toBe('#ff0000');
    });

    it('updates description', () => {
      const tag = tagService.createTag('DescTag', '#111');
      const updated = tagService.updateTag(tag.id, { description: 'Updated desc' });
      expect(updated.description).toBe('Updated desc');
    });

    it('throws if tag not found', () => {
      expect(() => tagService.updateTag('nonexistent', { name: 'x' })).toThrow(/not found/i);
    });

    it('throws for empty name update', () => {
      const tag = tagService.createTag('Valid', '#111');
      expect(() => tagService.updateTag(tag.id, { name: '' })).toThrow(/cannot be empty/i);
    });

    it('throws for duplicate name on update', () => {
      tagService.createTag('Existing', '#111');
      const tag = tagService.createTag('Other', '#222');
      expect(() => tagService.updateTag(tag.id, { name: 'Existing' })).toThrow(/already exists/i);
    });
  });

  // ── deleteTag ──

  describe('deleteTag()', () => {
    it('deletes tag', () => {
      const tag = tagService.createTag('ToDelete', '#111');
      const result = tagService.deleteTag(tag.id);
      expect(result.success).toBe(true);
      expect(result.tagName).toBe('ToDelete');

      const tags = tagService.getAllTags();
      expect(tags.some(t => t.id === tag.id)).toBe(false);
    });

    it('throws if tag not found', () => {
      expect(() => tagService.deleteTag('nonexistent')).toThrow(/not found/i);
    });
  });

  // ── File-Tag Associations ──

  describe('getFileTags()', () => {
    it('returns empty array for file with no tags', () => {
      const tags = tagService.getFileTags('testuser', 'untagged.html');
      expect(tags).toEqual([]);
    });

    it('returns tags after adding them', () => {
      const tag = tagService.createTag('MyFileTag', '#abc');
      tagService.addTagsToFile('testuser', 'myfile.html', [tag.name]);

      const tags = tagService.getFileTags('testuser', 'myfile.html');
      expect(tags).toContain(tag.name);
    });
  });

  describe('addTagsToFile()', () => {
    it('adds single tag', () => {
      const tag = tagService.createTag('AddedTag', '#123');
      const result = tagService.addTagsToFile('testuser', 'doc.html', [tag.name]);
      expect(result.success).toBe(true);
      expect(result.added).toContain(tag.name);
    });

    it('adds multiple tags', () => {
      const t1 = tagService.createTag('TagOne', '#111');
      const t2 = tagService.createTag('TagTwo', '#222');
      const result = tagService.addTagsToFile('testuser', 'multi.html', [t1.name, t2.name]);
      expect(result.added.length).toBe(2);
    });

    it('is idempotent (no duplicate tags)', () => {
      const tag = tagService.createTag('IdemTag', '#333');
      tagService.addTagsToFile('testuser', 'idem.html', [tag.name]);
      const result2 = tagService.addTagsToFile('testuser', 'idem.html', [tag.name]);
      expect(result2.added.length).toBe(0);
    });

    it('throws for non-existent tag', () => {
      expect(() => tagService.addTagsToFile('testuser', 'doc.html', ['NoExist']))
        .toThrow(/does not exist/i);
    });
  });

  describe('removeTagFromFile()', () => {
    it('removes tag from file', () => {
      const tag = tagService.createTag('RemTag', '#444');
      tagService.addTagsToFile('testuser', 'rem.html', [tag.name]);
      tagService.removeTagFromFile('testuser', 'rem.html', tag.name);

      const tags = tagService.getFileTags('testuser', 'rem.html');
      expect(tags).not.toContain(tag.name);
    });

    it('no-op if tag not present', () => {
      const result = tagService.removeTagFromFile('testuser', 'clean.html', 'NoTag');
      expect(result.success).toBe(true);
    });
  });

  // ── Queries ──

  describe('getFilesByTag()', () => {
    it('returns files with matching tag', () => {
      const tag = tagService.createTag('SearchTag', '#555');
      fs.writeFileSync(path.join(MOCK_WORKSPACE, 'tagged.html'), 'content');
      tagService.addTagsToFile('testuser', 'tagged.html', [tag.name]);

      const files = tagService.getFilesByTag('testuser', tag.name);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0].name).toBe('tagged.html');
    });

    it('returns empty array for tag with no files', () => {
      const tag = tagService.createTag('EmptyTag', '#666');
      const files = tagService.getFilesByTag('testuser', tag.name);
      expect(files).toEqual([]);
    });
  });

  describe('getFileRelationships()', () => {
    it('returns shared-tag relationships', () => {
      const tag = tagService.createTag('SharedTag', '#777');
      fs.writeFileSync(path.join(MOCK_WORKSPACE, 'fileA.html'), 'a');
      fs.writeFileSync(path.join(MOCK_WORKSPACE, 'fileB.html'), 'b');
      tagService.addTagsToFile('testuser', 'fileA.html', [tag.name]);
      tagService.addTagsToFile('testuser', 'fileB.html', [tag.name]);

      const rel = tagService.getFileRelationships('testuser', 'fileA.html');
      expect(rel.implicit.length).toBeGreaterThan(0);
      expect(rel.implicit[0].name).toBe('fileB.html');
    });

    it('returns empty for file with no tags', () => {
      const rel = tagService.getFileRelationships('testuser', 'noTags.html');
      expect(rel.implicit).toEqual([]);
    });
  });

  describe('listDirectoryWithTags()', () => {
    it('returns entries with tag annotations', () => {
      const tag = tagService.createTag('ListTag', '#888');
      fs.writeFileSync(path.join(MOCK_WORKSPACE, 'listed.html'), 'listed');
      tagService.addTagsToFile('testuser', 'listed.html', [tag.name]);

      const entries = tagService.listDirectoryWithTags('testuser', '');
      const listed = entries.find((e: any) => e.name === 'listed.html');
      expect(listed.tags).toContain(tag.name);
    });

    it('throws for non-existent directory', () => {
      expect(() => tagService.listDirectoryWithTags('testuser', 'nope')).toThrow(/not found/i);
    });
  });
});