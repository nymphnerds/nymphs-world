import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Create isolated temp root for all tests
let tempRoot = '';

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worbi-scene-'));
});

afterEach(() => {
  if (tempRoot && fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

// Helper to create a per-user workspace dir
function makeWorkspace(username: string) {
  const dir = path.join(tempRoot, username, 'workspace');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Mock authService to return per-user workspace dirs
const workspaces: Record<string, string> = {};
vi.mock('../../../src/services/authService.js', () => ({
  getUserWorkspaceDir: (username: string) => workspaces[username] || path.join(tempRoot, username, 'workspace'),
}));

import * as sceneService from '../../../src/services/sceneService.js';

// --- sceneService tests (per-user, v6.3.14+) ---

describe('sceneService (per-user v6.3.14)', () => {

  const userA = 'alice';
  const userB = 'bob';

  beforeEach(() => {
    // Create workspace dirs for both users
    workspaces[userA] = makeWorkspace(userA);
    workspaces[userB] = makeWorkspace(userB);
  });

  // ─── getAllScenes ───

  describe('getAllScenes(username)', () => {
    it('returns empty array for new user', () => {
      const scenes = sceneService.getAllScenes(userA);
      expect(scenes).toEqual([]);
    });

    it('returns scenes after creating some', () => {
      sceneService.createScene(userA, 'Goblin Cave', 'Year 1', 'Spring', 'Dungeon');
      sceneService.createScene(userA, 'Village Square', 'Year 1', '', 'Village');
      const scenes = sceneService.getAllScenes(userA);
      expect(scenes).toHaveLength(2);
      const names = scenes.map((s: any) => s.name);
      expect(names).toContain('Goblin Cave');
      expect(names).toContain('Village Square');
    });

    it('includes all fields (id, name, era, date, locationName)', () => {
      sceneService.createScene(userA, 'Tower Top', 'Year 2', 'Winter', 'Wizard Tower');
      const scenes = sceneService.getAllScenes(userA);
      const scene = scenes[0];
      expect(scene.id).toMatch(/^scene_/);
      expect(scene.name).toBe('Tower Top');
      expect(scene.era).toBe('Year 2');
      expect(scene.date).toBe('Winter');
      expect(scene.locationName).toBe('Wizard Tower');
    });

    it('handles corrupt JSON file', () => {
      const sceneFile = path.join(workspaces[userA], '.__wbu_scenes.json');
      fs.writeFileSync(sceneFile, 'NOT VALID JSON{{{', 'utf-8');
      // Should return empty array instead of crashing
      const scenes = sceneService.getAllScenes(userA);
      expect(scenes).toEqual([]);
    });
  });

  // ─── Per-user isolation ───

  describe('per-user isolation', () => {
    it('User A scenes do not appear for User B', () => {
      sceneService.createScene(userA, 'AliceCave', 'Year 1', '', 'Dungeon');
      sceneService.createScene(userA, 'AliceVillage', 'Year 1', '', 'Village');
      sceneService.createScene(userB, 'BobBase', 'Year 1', '', 'Fortress');

      const aScenes = sceneService.getAllScenes(userA);
      const bScenes = sceneService.getAllScenes(userB);

      expect(aScenes.length).toBe(2);
      expect(bScenes.length).toBe(1);
      expect(aScenes.map((s: any) => s.name)).not.toContain('BobBase');
      expect(bScenes.map((s: any) => s.name)).not.toContain('AliceCave');
    });

    it('User A file scene assignments do not affect User B', () => {
      sceneService.createScene(userA, 'Shared Scene', 'Year 1', '', 'Home');
      sceneService.createScene(userB, 'Shared Scene', 'Year 1', '', 'Home');

      const sceneA = sceneService.getAllScenes(userA)[0];
      const sceneB = sceneService.getAllScenes(userB)[0];

      sceneService.addScenesToFile(userA, 'doc.html', [sceneA.id]);
      sceneService.addScenesToFile(userB, 'doc.html', [sceneB.id]);

      const aFileScenes = sceneService.getFileScenes(userA, 'doc.html');
      const bFileScenes = sceneService.getFileScenes(userB, 'doc.html');

      expect(aFileScenes).toContain(sceneA.id);
      expect(bFileScenes).toContain(sceneB.id);
      expect(aFileScenes).not.toContain(sceneB.id);
      expect(bFileScenes).not.toContain(sceneA.id);
    });
  });

  // ─── createScene ───

  describe('createScene(username, name, era, date, locationName)', () => {
    it('creates scene with all fields', () => {
      const scene = sceneService.createScene(userA, 'Cave', 'Year 1', 'Spring', 'Dungeon');
      expect(scene.name).toBe('Cave');
      expect(scene.id).toMatch(/^scene_/);
      expect(scene.era).toBe('Year 1');
      expect(scene.date).toBe('Spring');
      expect(scene.locationName).toBe('Dungeon');
    });

    it('creates scene without date (optional)', () => {
      const scene = sceneService.createScene(userA, 'Cave2', 'Year 1', '', 'Dungeon');
      expect(scene.date).toBe('');
    });

    it('throws when name is empty', () => {
      expect(() => sceneService.createScene(userA, '', 'Year 1', '', 'Dungeon'))
        .toThrow('Scene name is required');
    });

    it('throws when name is whitespace only', () => {
      expect(() => sceneService.createScene(userA, '   ', 'Year 1', '', 'Dungeon'))
        .toThrow('Scene name is required');
    });

    it('throws when era is missing', () => {
      expect(() => sceneService.createScene(userA, 'Cave', '', '', 'Dungeon'))
        .toThrow('Era is required');
    });

    it('throws when locationName is missing', () => {
      expect(() => sceneService.createScene(userA, 'Cave', 'Year 1', '', ''))
        .toThrow('Location is required');
    });

    it('throws on duplicate name (case-insensitive)', () => {
      sceneService.createScene(userA, 'Cave', 'Year 1', '', 'Dungeon');
      expect(() => sceneService.createScene(userA, 'cave', 'Year 2', '', 'Dungeon'))
        .toThrow(/already exists/i);
    });

    it('trims whitespace from name', () => {
      const scene = sceneService.createScene(userA, '  Trimmed  ', 'Year 1', '', 'Dungeon');
      expect(scene.name).toBe('Trimmed');
    });

    it('allows same name in different users', () => {
      const sceneA = sceneService.createScene(userA, 'Home', 'Year 1', '', 'Village');
      const sceneB = sceneService.createScene(userB, 'Home', 'Year 1', '', 'Fortress');
      expect(sceneA.name).toBe('Home');
      expect(sceneB.name).toBe('Home');
      expect(sceneA.id).not.toBe(sceneB.id);
    });
  });

  // ─── updateScene ───

  describe('updateScene(username, id, updates)', () => {
    it('updates name', () => {
      const created = sceneService.createScene(userA, 'Temp', 'Year 1', '', 'Dungeon');
      const updated = sceneService.updateScene(userA, created.id, { name: 'Renamed' });
      expect(updated.name).toBe('Renamed');
    });

    it('updates era, date, locationName', () => {
      const created = sceneService.createScene(userA, 'Temp2', 'Year 1', '', 'Dungeon');
      const updated = sceneService.updateScene(userA, created.id, {
        era: 'Year 5',
        date: 'Autumn',
        locationName: 'Castle',
      });
      expect(updated.era).toBe('Year 5');
      expect(updated.date).toBe('Autumn');
      expect(updated.locationName).toBe('Castle');
    });

    it('throws when scene not found', () => {
      expect(() => sceneService.updateScene(userA, 'scene_nonexistent', { name: 'X' }))
        .toThrow('Scene not found');
    });

    it('throws on empty name update', () => {
      const created = sceneService.createScene(userA, 'Temp3', 'Year 1', '', 'Dungeon');
      expect(() => sceneService.updateScene(userA, created.id, { name: '' }))
        .toThrow('Scene name cannot be empty');
    });

    it('throws on duplicate name update', () => {
      sceneService.createScene(userA, 'Existing', 'Year 1', '', 'Dungeon');
      const created = sceneService.createScene(userA, 'Unique', 'Year 1', '', 'Dungeon');
      expect(() => sceneService.updateScene(userA, created.id, { name: 'existing' }))
        .toThrow(/already exists/i);
    });

    it('does not allow cross-user update', () => {
      const created = sceneService.createScene(userA, 'Secret', 'Year 1', '', 'Dungeon');
      expect(() => sceneService.updateScene(userB, created.id, { name: 'Hacked' }))
        .toThrow('Scene not found');
    });
  });

  // ─── deleteScene ───

  describe('deleteScene(username, id)', () => {
    it('deletes a scene', () => {
      const created = sceneService.createScene(userA, 'ToDelete', 'Year 1', '', 'Dungeon');
      const result = sceneService.deleteScene(userA, created.id);
      expect(result.success).toBe(true);
      const all = sceneService.getAllScenes(userA);
      expect(all.some((s: any) => s.id === created.id)).toBe(false);
    });

    it('throws when scene not found', () => {
      expect(() => sceneService.deleteScene(userA, 'scene_nonexistent'))
        .toThrow('Scene not found');
    });

    it('does not allow cross-user delete', () => {
      const created = sceneService.createScene(userA, 'Secret', 'Year 1', '', 'Dungeon');
      expect(() => sceneService.deleteScene(userB, created.id))
        .toThrow('Scene not found');
    });

    it('cascades deletion to file metadata', () => {
      const created = sceneService.createScene(userA, 'OldScene', 'Year 1', '', 'Dungeon');

      // Create a file in workspace
      fs.writeFileSync(path.join(workspaces[userA], 'adventure.html'), '<h1>Story</h1>');
      sceneService.addScenesToFile(userA, 'adventure.html', [created.id]);

      // Verify scene is on file
      let scenes = sceneService.getFileScenes(userA, 'adventure.html');
      expect(scenes).toContain(created.id);

      // Delete scene
      sceneService.deleteScene(userA, created.id);

      // Verify scene removed from file metadata
      scenes = sceneService.getFileScenes(userA, 'adventure.html');
      expect(scenes).not.toContain(created.id);
    });

    it('cascades deletion recursively through subdirectories', () => {
      const created = sceneService.createScene(userA, 'DeepScene', 'Year 1', '', 'Dungeon');

      // Create a file in a subdirectory
      const subDir = path.join(workspaces[userA], 'Chapters', 'Chapter1');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'scene.html'), '<h1>Scene</h1>');
      sceneService.addScenesToFile(userA, path.join('Chapters', 'Chapter1', 'scene.html'), [created.id]);

      // Verify scene is on file
      let scenes = sceneService.getFileScenes(userA, path.join('Chapters', 'Chapter1', 'scene.html'));
      expect(scenes).toContain(created.id);

      // Delete scene
      sceneService.deleteScene(userA, created.id);

      // Verify scene removed from file metadata
      scenes = sceneService.getFileScenes(userA, path.join('Chapters', 'Chapter1', 'scene.html'));
      expect(scenes).not.toContain(created.id);
    });
  });

  // ─── getFileScenes ───

  describe('getFileScenes(username, filePath)', () => {
    it('returns empty array for file with no scenes', () => {
      const scenes = sceneService.getFileScenes(userA, 'doc.html');
      expect(scenes).toEqual([]);
    });

    it('returns scene IDs after adding', () => {
      const s1 = sceneService.createScene(userA, 'Scene1', 'Year 1', '', 'Dungeon');
      const s2 = sceneService.createScene(userA, 'Scene2', 'Year 2', '', 'Village');
      sceneService.addScenesToFile(userA, 'doc.html', [s1.id, s2.id]);
      const scenes = sceneService.getFileScenes(userA, 'doc.html');
      expect(scenes).toContain(s1.id);
      expect(scenes).toContain(s2.id);
    });

    it('does not leak between users', () => {
      const s1 = sceneService.createScene(userA, 'Secret', 'Year 1', '', 'Dungeon');
      sceneService.addScenesToFile(userA, 'secret.html', [s1.id]);
      const scenes = sceneService.getFileScenes(userB, 'secret.html');
      expect(scenes).toEqual([]);
    });
  });

  // ─── addScenesToFile ───

  describe('addScenesToFile(username, filePath, sceneIds[])', () => {
    it('adds valid scene to file', () => {
      const s1 = sceneService.createScene(userA, 'Scene1', 'Year 1', '', 'Dungeon');
      const result = sceneService.addScenesToFile(userA, 'doc.html', [s1.id]);
      expect(result.success).toBe(true);
      expect(result.added).toContain(s1.id);
    });

    it('does not add duplicate', () => {
      const s1 = sceneService.createScene(userA, 'Scene1', 'Year 1', '', 'Dungeon');
      sceneService.addScenesToFile(userA, 'doc2.html', [s1.id]);
      const result2 = sceneService.addScenesToFile(userA, 'doc2.html', [s1.id]);
      expect(result2.added).toEqual([]);
    });

    it('throws for non-existent scene ID', () => {
      expect(() =>
        sceneService.addScenesToFile(userA, 'doc.html', ['scene_nonexistent'])
      ).toThrow(/does not exist/i);
    });

    it('throws only if any scene does not exist', () => {
      const s1 = sceneService.createScene(userA, 'Valid', 'Year 1', '', 'Dungeon');
      expect(() =>
        sceneService.addScenesToFile(userA, 'doc.html', [s1.id, 'scene_invalid'])
      ).toThrow(/does not exist/i);
    });

    it('adds multiple scenes at once', () => {
      const s1 = sceneService.createScene(userA, 'Forest', 'Year 1', '', 'Dungeon');
      const s2 = sceneService.createScene(userA, 'Mountain', 'Year 2', '', 'Village');
      const result = sceneService.addScenesToFile(userA, 'doc.html', [s1.id, s2.id]);
      expect(result.added).toContain(s1.id);
      expect(result.added).toContain(s2.id);
    });
  });

  // ─── removeSceneFromFile ───

  describe('removeSceneFromFile(username, filePath, sceneId)', () => {
    it('removes scene from file', () => {
      const s1 = sceneService.createScene(userA, 'Scene1', 'Year 1', '', 'Dungeon');
      const s2 = sceneService.createScene(userA, 'Scene2', 'Year 2', '', 'Village');
      sceneService.addScenesToFile(userA, 'doc3.html', [s1.id, s2.id]);
      let scenes = sceneService.getFileScenes(userA, 'doc3.html');
      expect(scenes.length).toBe(2);

      sceneService.removeSceneFromFile(userA, 'doc3.html', s1.id);
      const scenesAfter = sceneService.getFileScenes(userA, 'doc3.html');
      expect(scenesAfter).not.toContain(s1.id);
      expect(scenesAfter).toContain(s2.id);
    });

    it('succeeds even if scene was not on file', () => {
      const result = sceneService.removeSceneFromFile(userA, 'empty.html', 'scene_nonexistent');
      expect(result.success).toBe(true);
    });
  });

  // ─── loadFileMeta / saveFileMeta ───

  describe('loadFileMeta(username, filePath)', () => {
    it('returns default meta for new file', () => {
      const meta = sceneService.loadFileMeta(userA, 'new.html');
      expect(meta).toEqual({ tags: [], relationships: [], locations: [], scenes: [] });
    });

    it('adds scenes field for backward compatibility', () => {
      // Write meta without scenes field
      const metaPath = path.join(workspaces[userA], '.__old.html.wbu_meta.json');
      fs.writeFileSync(metaPath, JSON.stringify({ tags: ['lore'], locations: ['Dungeon'] }), 'utf-8');
      const meta = sceneService.loadFileMeta(userA, 'old.html');
      expect(meta.scenes).toEqual([]);
      expect(meta.tags).toContain('lore');
    });

    it('handles corrupt metadata gracefully', () => {
      fs.writeFileSync(path.join(workspaces[userA], 'doc.html'), '<h1>Hi</h1>');
      const metaFile = path.join(workspaces[userA], '.__doc.html.wbu_meta.json');
      fs.writeFileSync(metaFile, 'CORRUPT DATA', 'utf-8');
      const meta = sceneService.loadFileMeta(userA, 'doc.html');
      expect(meta).toEqual({ tags: [], relationships: [], locations: [], scenes: [] });
    });
  });

  describe('saveFileMeta(username, filePath, meta)', () => {
    it('saves and reloads metadata', () => {
      const meta = { tags: ['test'], relationships: [], locations: [], scenes: ['scene_123'] };
      sceneService.saveFileMeta(userA, 'test.html', meta);
      const reloaded = sceneService.loadFileMeta(userA, 'test.html');
      expect(reloaded.tags).toContain('test');
      expect(reloaded.scenes).toContain('scene_123');
    });
  });

  // ─── Edge cases ───

  describe('edge cases', () => {
    it('handles corrupt scenes registry file', () => {
      const sceneFile = path.join(workspaces[userA], '.__wbu_scenes.json');
      fs.writeFileSync(sceneFile, 'NOT VALID JSON{{{', 'utf-8');
      // Should return empty array instead of crashing
      const scenes = sceneService.getAllScenes(userA);
      expect(scenes).toEqual([]);
    });

    it('handles corrupt file metadata gracefully', () => {
      fs.writeFileSync(path.join(workspaces[userA], 'doc.html'), '<h1>Hi</h1>');
      const metaFile = path.join(workspaces[userA], '.__doc.html.wbu_meta.json');
      fs.writeFileSync(metaFile, 'CORRUPT DATA', 'utf-8');
      // Should not crash
      const scenes = sceneService.getFileScenes(userA, 'doc.html');
      expect(scenes).toEqual([]);
    });

    it('removeSceneFromAllFiles skips corrupt meta files', () => {
      const s1 = sceneService.createScene(userA, 'BadScene', 'Year 1', '', 'Dungeon');
      fs.writeFileSync(path.join(workspaces[userA], 'good.html'), '<h1>Good</h1>');
      fs.writeFileSync(path.join(workspaces[userA], 'bad.html'), '<h1>Bad</h1>');
      sceneService.addScenesToFile(userA, 'good.html', [s1.id]);

      // Write corrupt metadata for bad.html
      const metaFile = path.join(workspaces[userA], '.__bad.html.wbu_meta.json');
      fs.writeFileSync(metaFile, 'GARBAGE', 'utf-8');

      // Should not crash — only cleans good.html
      sceneService.deleteScene(userA, s1.id);

      const goodScenes = sceneService.getFileScenes(userA, 'good.html');
      expect(goodScenes).not.toContain(s1.id);
    });
  });
});