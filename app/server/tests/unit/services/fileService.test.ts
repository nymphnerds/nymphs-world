import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock authService before importing fileService
vi.mock('../../../src/services/authService.js', () => ({
  getUserWorkspaceDir: vi.fn((username: string) => `/tmp/worbi/${username}/workspace`),
  getUserAssetsDir: vi.fn((username: string) => `/tmp/worbi/${username}/assets`),
}));

import * as fileService from '../../../src/services/fileService.js';

describe('searchWorkspace', () => {
  const mockUsername = 'testuser';
  const mockWorkspaceRoot = `/tmp/worbi/${mockUsername}/workspace`;

  beforeEach(() => {
    vi.clearAllMocks();
    if (fs.existsSync(mockWorkspaceRoot)) {
      fs.rmSync(mockWorkspaceRoot, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(mockWorkspaceRoot)) {
      fs.rmSync(mockWorkspaceRoot, { recursive: true, force: true });
    }
  });

  describe('basic search', () => {
    it('returns empty results when workspace is empty', () => {
      fs.mkdirSync(mockWorkspaceRoot, { recursive: true });
      const result = fileService.searchWorkspace(mockUsername, 'hello');
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('finds file by name match', () => {
      // Setup: create a file named JimmyDog.html
      const npcDir = path.join(mockWorkspaceRoot, 'NPCs');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.writeFileSync(path.join(npcDir, 'JimmyDog.html'), '<html>NPC content</html>');

      const result = fileService.searchWorkspace(mockUsername, 'jimmy');

      expect(result.total).toBeGreaterThanOrEqual(1);
      const match = result.results.find(r => r.name === 'JimmyDog.html');
      expect(match).toBeDefined();
      expect(match?.path).toBe('NPCs/JimmyDog.html');
      expect(match?.type).toBe('file');
      // Name-only match produces a "Name matches:" context
      expect(match?.matches[0].context).toContain('Name matches');
    });

    it('finds file by content match', () => {
      const npcDir = path.join(mockWorkspaceRoot, 'NPCs');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.writeFileSync(
        path.join(npcDir, 'JackWills.html'),
        '<html><h3>NPC - Jack (mentor figure)</h3><p>The Market Maker</p></html>'
      );

      const result = fileService.searchWorkspace(mockUsername, 'mentor');

      expect(result.total).toBeGreaterThanOrEqual(1);
      const match = result.results.find(r => r.name === 'JackWills.html');
      expect(match).toBeDefined();
      // Content match should include the matched line context
      expect(match?.matches[0].context).toContain('mentor');
    });

    it('finds both name and content matches', () => {
      const npcDir = path.join(mockWorkspaceRoot, 'NPCs');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.writeFileSync(path.join(npcDir, 'Dragon.html'), '<html>The great dragon of the north</html>');
      fs.writeFileSync(path.join(npcDir, 'Knight.html'), '<html>A dragon slayer</html>');

      // Search for "dragon" should match Dragon.html by name AND content, and Knight.html by content
      const result = fileService.searchWorkspace(mockUsername, 'dragon');

      expect(result.total).toBeGreaterThanOrEqual(2);
      const dragonFile = result.results.find(r => r.name === 'Dragon.html');
      const knightFile = result.results.find(r => r.name === 'Knight.html');
      expect(dragonFile).toBeDefined();
      expect(knightFile).toBeDefined();
    });
  });

  describe('system file filtering', () => {
    it('excludes dotfiles from search results', () => {
      fs.mkdirSync(mockWorkspaceRoot, { recursive: true });
      fs.writeFileSync(path.join(mockWorkspaceRoot, '.wbu_recents.json'), '{"recents":[]}');
      fs.writeFileSync(path.join(mockWorkspaceRoot, 'MyFile.html'), 'real content');

      const result = fileService.searchWorkspace(mockUsername, 'real');

      // Should find MyFile.html
      expect(result.results.find(r => r.name === 'MyFile.html')).toBeDefined();
      // Should NOT find .wbu_recents.json
      expect(result.results.find(r => r.name.startsWith('.'))).toBeUndefined();
    });

    it('excludes .wbu_meta.json files from search results', () => {
      const npcDir = path.join(mockWorkspaceRoot, 'NPCs');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.writeFileSync(path.join(npcDir, 'Hero.html'), 'Hero content here');
      fs.writeFileSync(path.join(npcDir, '__Hero.html.wbu_meta.json'), '{"tags":["main"]}');

      const result = fileService.searchWorkspace(mockUsername, 'hero');

      // Should find Hero.html
      expect(result.results.find(r => r.name === 'Hero.html')).toBeDefined();
      // Should NOT find __Hero.html.wbu_meta.json
      expect(result.results.find(r => r.name.endsWith('.wbu_meta.json'))).toBeUndefined();
    });

    it('excludes files inside dot-directories', () => {
      fs.mkdirSync(mockWorkspaceRoot, { recursive: true });
      // Create a hidden directory (edge case)
      const hiddenDir = path.join(mockWorkspaceRoot, '.hidden');
      fs.mkdirSync(hiddenDir, { recursive: true });
      fs.writeFileSync(path.join(hiddenDir, 'secret.html'), 'hidden content');
      fs.writeFileSync(path.join(mockWorkspaceRoot, 'Visible.html'), 'visible content');

      const result = fileService.searchWorkspace(mockUsername, 'content');

      expect(result.results.find(r => r.name === 'Visible.html')).toBeDefined();
      expect(result.results.find(r => r.name === 'secret.html')).toBeUndefined();
    });

    it('excludes binary files from search', () => {
      fs.mkdirSync(mockWorkspaceRoot, { recursive: true });
      // Write a binary file (PNG header bytes)
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]);
      fs.writeFileSync(path.join(mockWorkspaceRoot, 'image.png'), pngBuffer);
      fs.writeFileSync(path.join(mockWorkspaceRoot, 'notes.txt'), 'searchable text');

      const result = fileService.searchWorkspace(mockUsername, 'searchable');

      expect(result.results.find(r => r.name === 'notes.txt')).toBeDefined();
      expect(result.results.find(r => r.name === 'image.png')).toBeUndefined();
    });
  });

  describe('search results format', () => {
    it('returns results with correct structure', () => {
      const npcDir = path.join(mockWorkspaceRoot, 'NPCs');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.writeFileSync(path.join(npcDir, 'Test.html'), 'Line one\nLine two with match\nLine three');

      const result = fileService.searchWorkspace(mockUsername, 'match');

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.results)).toBe(true);

      const match = result.results.find(r => r.name === 'Test.html');
      expect(match?.name).toBe('Test.html');
      expect(match?.path).toBe('NPCs/Test.html');
      expect(match?.type).toBe('file');
      expect(Array.isArray(match?.matches)).toBe(true);
      expect(match?.matches[0]).toHaveProperty('line');
      expect(match?.matches[0]).toHaveProperty('context');
    });

    it('limits results to the specified limit', () => {
      fs.mkdirSync(mockWorkspaceRoot, { recursive: true });
      // Create many files matching "test"
      for (let i = 0; i < 20; i++) {
        fs.writeFileSync(path.join(mockWorkspaceRoot, `Test${i}.html`), `test content ${i}`);
      }

      const result = fileService.searchWorkspace(mockUsername, 'test', { limit: 5 });

      // Each file matches both name and content, but name match takes priority and skips content scan
      // So results can include both name and content matches, capped at limit
      expect(result.results.length).toBeLessThanOrEqual(5);
    });

    it('handles case-insensitive search', () => {
      const npcDir = path.join(mockWorkspaceRoot, 'NPCs');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.writeFileSync(path.join(npcDir, 'Dragon.html'), 'The DRAGON flies over mountains');

      // Lowercase query
      const lowerRes = fileService.searchWorkspace(mockUsername, 'dragon');
      expect(lowerRes.total).toBeGreaterThanOrEqual(1);

      // Uppercase query
      const upperRes = fileService.searchWorkspace(mockUsername, 'DRAGON');
      expect(upperRes.total).toBeGreaterThanOrEqual(1);

      // Mixed case query
      const mixedRes = fileService.searchWorkspace(mockUsername, 'DrAgOn');
      expect(mixedRes.total).toBeGreaterThanOrEqual(1);
    });

    it('truncates long context lines with ellipsis', () => {
      fs.mkdirSync(mockWorkspaceRoot, { recursive: true });
      const longLine = 'A'.repeat(50) + 'rareword' + 'B'.repeat(80);
      fs.writeFileSync(path.join(mockWorkspaceRoot, 'Long.html'), longLine);

      const result = fileService.searchWorkspace(mockUsername, 'rareword');

      const match = result.results.find(r => r.name === 'Long.html');
      expect(match).toBeDefined();
      expect(match?.matches[0].context).toContain('rareword');
      // Context should be truncated
      expect(match?.matches[0].context.startsWith('...')).toBe(true);
    });
  });

  describe('nested folder search', () => {
    it('searches recursively through nested folders', () => {
      const deepDir = path.join(mockWorkspaceRoot, 'Quests', 'Acts', 'Act1');
      fs.mkdirSync(deepDir, { recursive: true });
      fs.writeFileSync(path.join(deepDir, 'GoblinDen.html'), 'The goblin lair is deep underground');

      const result = fileService.searchWorkspace(mockUsername, 'goblin');

      expect(result.total).toBeGreaterThanOrEqual(1);
      const match = result.results.find(r => r.name === 'GoblinDen.html');
      expect(match).toBeDefined();
      expect(match?.path).toBe('Quests/Acts/Act1/GoblinDen.html');
    });
  });
});