import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Create isolated temp root for all tests
let tempRoot = '';

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worbi-loc-'));
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

import * as locationService from '../../../src/services/locationService.js';

// --- locationService tests (per-user, v6.3.9+) ---

describe('locationService (per-user v6.3.9)', () => {

  const userA = 'alice';
  const userB = 'bob';

  beforeEach(() => {
    // Create workspace dirs for both users
    workspaces[userA] = makeWorkspace(userA);
    workspaces[userB] = makeWorkspace(userB);
  });

  // ─── getAllLocations ───

  describe('getAllLocations(username)', () => {
    it('returns empty array for new user', () => {
      const locations = locationService.getAllLocations(userA);
      expect(locations).toEqual([]);
    });

    it('returns locations after creating some', () => {
      locationService.createLocation(userA, 'Dungeon', '#8b5cf6', 'Underground lair');
      locationService.createLocation(userA, 'Village', '#22c55e', 'Starting town');
      const locations = locationService.getAllLocations(userA);
      expect(locations).toHaveLength(2);
      const names = locations.map((l: any) => l.name);
      expect(names).toContain('Dungeon');
      expect(names).toContain('Village');
    });

    it('includes id, name, color, description fields', () => {
      locationService.createLocation(userA, 'Tower', '#f59e0b', 'Wizard tower');
      const locations = locationService.getAllLocations(userA);
      const loc = locations[0];
      expect(loc.id).toMatch(/^loc_/);
      expect(loc.name).toBe('Tower');
      expect(loc.color).toBe('#f59e0b');
      expect(loc.description).toBe('Wizard tower');
    });
  });

  // ─── Per-user isolation ───

  describe('per-user isolation', () => {
    it('User A locations do not appear for User B', () => {
      locationService.createLocation(userA, 'AliceHome', '#22c55e', 'Alice home');
      locationService.createLocation(userA, 'AliceWork', '#3b82f6', 'Alice work');
      locationService.createLocation(userB, 'BobBase', '#ef4444', 'Bob base');

      const aLocs = locationService.getAllLocations(userA);
      const bLocs = locationService.getAllLocations(userB);

      expect(aLocs.length).toBe(2);
      expect(bLocs.length).toBe(1);
      expect(aLocs.map((l: any) => l.name)).not.toContain('BobBase');
      expect(bLocs.map((l: any) => l.name)).not.toContain('AliceHome');
    });

    it('User A file locations do not affect User B', () => {
      locationService.createLocation(userA, 'Home', '#22c55e', '');
      locationService.createLocation(userB, 'Home', '#ef4444', '');

      locationService.addLocationsToFile(userA, 'doc.html', ['Home']);
      locationService.addLocationsToFile(userB, 'doc.html', ['Home']);

      const aFileLocs = locationService.getFileLocations(userA, 'doc.html');
      const bFileLocs = locationService.getFileLocations(userB, 'doc.html');

      expect(aFileLocs).toContain('Home');
      expect(bFileLocs).toContain('Home');

      // They share the same location name but have different registries
      const aAll = locationService.getAllLocations(userA);
      const bAll = locationService.getAllLocations(userB);
      expect(aAll[0].color).toBe('#22c55e');
      expect(bAll[0].color).toBe('#ef4444');
    });
  });

  // ─── createLocation ───

  describe('createLocation(username, name, color, description)', () => {
    it('creates a location with name and defaults', () => {
      const loc = locationService.createLocation(userA, 'Gym', undefined, 'Fitness center');
      expect(loc.name).toBe('Gym');
      expect(loc.id).toMatch(/^loc_/);
      expect(loc.color).toBe('#10b981');
      expect(loc.description).toBe('Fitness center');
    });

    it('creates with custom color', () => {
      const loc = locationService.createLocation(userA, 'Gym2', '#ff0000', 'Red gym');
      expect(loc.color).toBe('#ff0000');
    });

    it('throws when name is empty', () => {
      expect(() => locationService.createLocation(userA, '', undefined, '')).toThrow('Location name is required');
    });

    it('throws when name is whitespace only', () => {
      expect(() => locationService.createLocation(userA, '   ', undefined, '')).toThrow('Location name is required');
    });

    it('throws on duplicate name (case-insensitive)', () => {
      locationService.createLocation(userA, 'Home', undefined, '');
      expect(() => locationService.createLocation(userA, 'home', undefined, '')).toThrow(/already exists/i);
    });

    it('trims whitespace from name', () => {
      const loc = locationService.createLocation(userA, '  Trimmed  ', undefined, '');
      expect(loc.name).toBe('Trimmed');
    });

    it('allows same name in different users', () => {
      const locA = locationService.createLocation(userA, 'Home', '#22c55e', 'Alice home');
      const locB = locationService.createLocation(userB, 'Home', '#ef4444', 'Bob home');
      expect(locA.name).toBe('Home');
      expect(locB.name).toBe('Home');
      expect(locA.id).not.toBe(locB.id);
    });
  });

  // ─── updateLocation ───

  describe('updateLocation(username, id, updates)', () => {
    it('updates name', () => {
      const created = locationService.createLocation(userA, 'Temp', undefined, '');
      const updated = locationService.updateLocation(userA, created.id, { name: 'Renamed' });
      expect(updated.name).toBe('Renamed');
    });

    it('updates color and description', () => {
      const created = locationService.createLocation(userA, 'Temp2', undefined, '');
      const updated = locationService.updateLocation(userA, created.id, {
        color: '#00ff00',
        description: 'Updated desc',
      });
      expect(updated.color).toBe('#00ff00');
      expect(updated.description).toBe('Updated desc');
    });

    it('throws when location not found', () => {
      expect(() => locationService.updateLocation(userA, 'loc_nonexistent', { name: 'X' }))
        .toThrow('Location not found');
    });

    it('throws on empty name update', () => {
      const created = locationService.createLocation(userA, 'Temp3', undefined, '');
      expect(() => locationService.updateLocation(userA, created.id, { name: '' }))
        .toThrow('Location name cannot be empty');
    });

    it('throws on duplicate name update', () => {
      locationService.createLocation(userA, 'Existing', undefined, '');
      const created = locationService.createLocation(userA, 'Unique', undefined, '');
      expect(() => locationService.updateLocation(userA, created.id, { name: 'existing' }))
        .toThrow(/already exists/i);
    });

    it('does not allow cross-user update', () => {
      const created = locationService.createLocation(userA, 'Secret', undefined, '');
      expect(() => locationService.updateLocation(userB, created.id, { name: 'Hacked' }))
        .toThrow('Location not found');
    });
  });

  // ─── deleteLocation ───

  describe('deleteLocation(username, id)', () => {
    it('deletes a location', () => {
      const created = locationService.createLocation(userA, 'ToDelete', undefined, '');
      const result = locationService.deleteLocation(userA, created.id);
      expect(result.success).toBe(true);
      const all = locationService.getAllLocations(userA);
      expect(all.some((l: any) => l.id === created.id)).toBe(false);
    });

    it('throws when location not found', () => {
      expect(() => locationService.deleteLocation(userA, 'loc_nonexistent'))
        .toThrow('Location not found');
    });

    it('does not allow cross-user delete', () => {
      const created = locationService.createLocation(userA, 'Secret', undefined, '');
      expect(() => locationService.deleteLocation(userB, created.id))
        .toThrow('Location not found');
    });

    it('cascades deletion to file metadata', () => {
      const created = locationService.createLocation(userA, 'OldPlace', '#22c55e', '');

      // Create a file in workspace
      fs.writeFileSync(path.join(workspaces[userA], 'adventure.html'), '<h1>Story</h1>');
      locationService.addLocationsToFile(userA, 'adventure.html', ['OldPlace']);

      // Verify location is on file
      let locs = locationService.getFileLocations(userA, 'adventure.html');
      expect(locs).toContain('OldPlace');

      // Delete location
      locationService.deleteLocation(userA, created.id);

      // Verify location removed from file metadata
      locs = locationService.getFileLocations(userA, 'adventure.html');
      expect(locs).not.toContain('OldPlace');
    });

    it('cascades deletion recursively through subdirectories', () => {
      const created = locationService.createLocation(userA, 'DeepPlace', '#3b82f6', '');

      // Create a file in a subdirectory
      const subDir = path.join(workspaces[userA], 'Chapters', 'Chapter1');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'scene.html'), '<h1>Scene</h1>');
      locationService.addLocationsToFile(userA, path.join('Chapters', 'Chapter1', 'scene.html'), ['DeepPlace']);

      // Verify location is on file
      let locs = locationService.getFileLocations(userA, path.join('Chapters', 'Chapter1', 'scene.html'));
      expect(locs).toContain('DeepPlace');

      // Delete location
      locationService.deleteLocation(userA, created.id);

      // Verify location removed from file metadata
      locs = locationService.getFileLocations(userA, path.join('Chapters', 'Chapter1', 'scene.html'));
      expect(locs).not.toContain('DeepPlace');
    });
  });

  // ─── getFileLocations ───

  describe('getFileLocations(username, filePath)', () => {
    it('returns empty array for file with no locations', () => {
      const locs = locationService.getFileLocations(userA, 'doc.html');
      expect(locs).toEqual([]);
    });

    it('returns locations after adding', () => {
      locationService.createLocation(userA, 'Forest', '#22c55e', '');
      locationService.createLocation(userA, 'River', '#3b82f6', '');
      locationService.addLocationsToFile(userA, 'doc.html', ['Forest', 'River']);
      const locs = locationService.getFileLocations(userA, 'doc.html');
      expect(locs).toContain('Forest');
      expect(locs).toContain('River');
    });

    it('does not leak between users', () => {
      locationService.createLocation(userA, 'Secret', '#22c55e', '');
      locationService.addLocationsToFile(userA, 'secret.html', ['Secret']);
      const locs = locationService.getFileLocations(userB, 'secret.html');
      expect(locs).toEqual([]);
    });
  });

  // ─── addLocationsToFile ───

  describe('addLocationsToFile(username, filePath, locationNames)', () => {
    it('adds a valid location to file', () => {
      locationService.createLocation(userA, 'Home', '#22c55e', '');
      const result = locationService.addLocationsToFile(userA, 'doc.html', ['Home']);
      expect(result.success).toBe(true);
      expect(result.added).toContain('Home');
    });

    it('does not add duplicate', () => {
      locationService.createLocation(userA, 'Home', '#22c55e', '');
      locationService.addLocationsToFile(userA, 'doc2.html', ['Home']);
      const result2 = locationService.addLocationsToFile(userA, 'doc2.html', ['Home']);
      expect(result2.added).toEqual([]);
    });

    it('throws for non-existent location', () => {
      expect(() =>
        locationService.addLocationsToFile(userA, 'doc.html', ['NonExistent'])
      ).toThrow(/does not exist/i);
    });

    it('throws only if any location does not exist', () => {
      locationService.createLocation(userA, 'Valid', '#22c55e', '');
      expect(() =>
        locationService.addLocationsToFile(userA, 'doc.html', ['Valid', 'Invalid'])
      ).toThrow(/does not exist/i);
    });

    it('adds multiple locations at once', () => {
      locationService.createLocation(userA, 'Forest', '#22c55e', '');
      locationService.createLocation(userA, 'Mountain', '#f59e0b', '');
      const result = locationService.addLocationsToFile(userA, 'doc.html', ['Forest', 'Mountain']);
      expect(result.added).toContain('Forest');
      expect(result.added).toContain('Mountain');
    });
  });

  // ─── removeLocationFromFile ───

  describe('removeLocationFromFile(username, filePath, locationName)', () => {
    it('removes location from file', () => {
      locationService.createLocation(userA, 'Home', '#22c55e', '');
      locationService.createLocation(userA, 'Work', '#3b82f6', '');
      locationService.addLocationsToFile(userA, 'doc3.html', ['Home', 'Work']);
      let locs = locationService.getFileLocations(userA, 'doc3.html');
      expect(locs.length).toBe(2);

      locationService.removeLocationFromFile(userA, 'doc3.html', 'Home');
      const locsAfter = locationService.getFileLocations(userA, 'doc3.html');
      expect(locsAfter).not.toContain('Home');
      expect(locsAfter).toContain('Work');
    });

    it('succeeds even if location was not on file', () => {
      const result = locationService.removeLocationFromFile(userA, 'empty.html', 'Home');
      expect(result.success).toBe(true);
    });
  });

  // ─── setFileLocations ───

  describe('setFileLocations(username, filePath, locationNames)', () => {
    it('replaces all locations', () => {
      locationService.createLocation(userA, 'Home', '#22c55e', '');
      locationService.createLocation(userA, 'Work', '#3b82f6', '');
      locationService.createLocation(userA, 'Travel', '#f59e0b', '');
      locationService.addLocationsToFile(userA, 'doc4.html', ['Home', 'Work']);
      const result = locationService.setFileLocations(userA, 'doc4.html', ['Travel']);
      expect(result.locations).toEqual(['Travel']);

      const locs = locationService.getFileLocations(userA, 'doc4.html');
      expect(locs).toEqual(['Travel']);
    });

    it('throws for non-existent location', () => {
      expect(() =>
        locationService.setFileLocations(userA, 'doc.html', ['NonExistent'])
      ).toThrow(/does not exist/i);
    });

    it('allows replacing with empty array', () => {
      locationService.createLocation(userA, 'Home', '#22c55e', '');
      locationService.addLocationsToFile(userA, 'doc5.html', ['Home']);
      const result = locationService.setFileLocations(userA, 'doc5.html', []);
      expect(result.locations).toEqual([]);
      const locs = locationService.getFileLocations(userA, 'doc5.html');
      expect(locs).toEqual([]);
    });
  });

  // ─── getFilesByLocation ───

  describe('getFilesByLocation(username, locationName)', () => {
    it('returns files with the location', () => {
      locationService.createLocation(userA, 'Home', '#22c55e', '');
      fs.writeFileSync(path.join(workspaces[userA], 'located.html'), '<h1>Hi</h1>');
      locationService.addLocationsToFile(userA, 'located.html', ['Home']);

      const results = locationService.getFilesByLocation(userA, 'Home');
      expect(results.length).toBeGreaterThanOrEqual(1);
      const found = results.find((r: any) => r.name === 'located.html');
      expect(found).toBeDefined();
      expect(found!.locations).toContain('Home');
    });

    it('returns empty array for location with no files', () => {
      locationService.createLocation(userA, 'Empty', '#3b82f6', '');
      const results = locationService.getFilesByLocation(userA, 'Empty');
      expect(results).toEqual([]);
    });

    it('skips dotfiles', () => {
      locationService.createLocation(userA, 'Home', '#22c55e', '');
      fs.writeFileSync(path.join(workspaces[userA], '.hidden'), 'secret');
      locationService.addLocationsToFile(userA, '.hidden', ['Home']);
      const results = locationService.getFilesByLocation(userA, 'Home');
      const hidden = results.find((r: any) => r.name === '.hidden');
      expect(hidden).toBeUndefined();
    });

    it('scans recursively into subdirectories', () => {
      locationService.createLocation(userA, 'Deep', '#f59e0b', '');
      const subDir = path.join(workspaces[userA], 'Folder', 'SubFolder');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'deep.html'), '<h1>Deep</h1>');
      locationService.addLocationsToFile(userA, path.join('Folder', 'SubFolder', 'deep.html'), ['Deep']);

      const results = locationService.getFilesByLocation(userA, 'Deep');
      expect(results.length).toBeGreaterThanOrEqual(1);
      const found = results.find((r: any) => r.name === 'deep.html');
      expect(found).toBeDefined();
    });

    it('does not leak between users', () => {
      locationService.createLocation(userA, 'Secret', '#22c55e', '');
      locationService.createLocation(userB, 'Secret', '#ef4444', '');
      fs.writeFileSync(path.join(workspaces[userA], 'secret.html'), '<h1>Secret</h1>');
      locationService.addLocationsToFile(userA, 'secret.html', ['Secret']);

      const results = locationService.getFilesByLocation(userB, 'Secret');
      expect(results).toEqual([]);
    });
  });

  // ─── Edge cases ───

  describe('edge cases', () => {
    it('handles corrupt location file gracefully', () => {
      const locFile = path.join(workspaces[userA], '.__wbu_locations.json');
      fs.writeFileSync(locFile, 'NOT VALID JSON{{{', 'utf-8');
      // Should return empty array instead of crashing
      const locations = locationService.getAllLocations(userA);
      expect(locations).toEqual([]);
    });

    it('handles corrupt file metadata gracefully', () => {
      locationService.createLocation(userA, 'Home', '#22c55e', '');
      fs.writeFileSync(path.join(workspaces[userA], 'doc.html'), '<h1>Hi</h1>');
      // Write corrupt metadata file
      const metaDir = workspaces[userA];
      const metaFile = path.join(metaDir, '.__doc.html.wbu_meta.json');
      fs.writeFileSync(metaFile, 'CORRUPT DATA', 'utf-8');
      // Should not crash
      const locs = locationService.getFileLocations(userA, 'doc.html');
      expect(locs).toEqual([]);
    });

    it('removeLocationFromAllFiles skips corrupt meta files', () => {
      locationService.createLocation(userA, 'BadPlace', '#ef4444', '');
      fs.writeFileSync(path.join(workspaces[userA], 'good.html'), '<h1>Good</h1>');
      fs.writeFileSync(path.join(workspaces[userA], 'bad.html'), '<h1>Bad</h1>');
      locationService.addLocationsToFile(userA, 'good.html', ['BadPlace']);

      // Write corrupt metadata for bad.html
      const metaFile = path.join(workspaces[userA], '.__bad.html.wbu_meta.json');
      fs.writeFileSync(metaFile, 'GARBAGE', 'utf-8');

      // Should not crash — only clean good.html
      locationService.deleteLocation(userA, locationService.getAllLocations(userA)[0].id);

      const goodLocs = locationService.getFileLocations(userA, 'good.html');
      expect(goodLocs).not.toContain('BadPlace');
    });
  });
});