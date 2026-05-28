import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock authService before importing dialogueService
vi.mock('../../../src/services/authService.js', () => ({
  getUserWorkspaceDir: vi.fn(),
}));

// Mock sceneService before importing dialogueService
vi.mock('../../../src/services/sceneService.js', () => ({
  getAllScenes: vi.fn(),
  addScenesToFile: vi.fn(),
  loadFileMeta: vi.fn(),
}));

import * as authServiceMock from '../../../src/services/authService.js';
import * as sceneServiceMock from '../../../src/services/sceneService.js';
import * as dialogueService from '../../../src/services/dialogueService.js';

const mockGetUserWorkspaceDir = authServiceMock.getUserWorkspaceDir as ReturnType<typeof vi.fn>;
const mockGetAllScenes = sceneServiceMock.getAllScenes as ReturnType<typeof vi.fn>;
const mockAddScenesToFile = sceneServiceMock.addScenesToFile as ReturnType<typeof vi.fn>;
const mockLoadFileMeta = sceneServiceMock.loadFileMeta as ReturnType<typeof vi.fn>;

describe('dialogueService', () => {
  let tempRoot = '';
  let workspaceDir = '';
  const testUser = 'testuser';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worbi-dialogue-test-'));
    workspaceDir = path.join(tempRoot, 'workspace');
    fs.mkdirSync(workspaceDir, { recursive: true });

    mockGetUserWorkspaceDir.mockImplementation((username: string) => {
      if (username === testUser) return workspaceDir;
      throw new Error(`Unknown user: ${username}`);
    });
    mockGetAllScenes.mockReturnValue([]);
    mockAddScenesToFile.mockResolvedValue(undefined);
    mockLoadFileMeta.mockReturnValue({});
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  describe('sanitizeFileName', () => {
    it('replaces path-unsafe characters with underscores', () => {
      // : * ? " < > | / \ are all replaced with _
      expect(dialogueService.sanitizeFileName('File: Name*Test')).toBe('File_ Name_Test');
      expect(dialogueService.sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
    });

    it('collapses multiple whitespace', () => {
      expect(dialogueService.sanitizeFileName('Hello    World')).toBe('Hello World');
    });

    it('trims leading and trailing whitespace', () => {
      expect(dialogueService.sanitizeFileName('  Trimmed  ')).toBe('Trimmed');
    });

    it('handles normal names', () => {
      expect(dialogueService.sanitizeFileName('The Final Battle')).toBe('The Final Battle');
    });
  });

  describe('generateDialogueHtml', () => {
    it('generates HTML header without date', () => {
      const scene = { id: 's1', name: 'Test Scene', era: 'Modern', locationName: 'City' };
      const html = dialogueService.generateDialogueHtml(scene);
      expect(html).toContain('<!-- Build: Yes -->');
      expect(html).toContain('<!-- Template: Dialogue -->');
      expect(html).toContain('<h2>Scene: Test Scene</h2>');
      expect(html).toContain('<strong>Era:</strong> Modern');
      expect(html).toContain('<strong>Location:</strong> City');
      expect(html).not.toContain('Date:');
    });

    it('generates HTML header with date', () => {
      const scene = { id: 's1', name: 'Dated Scene', era: 'Ancient', locationName: 'Temple', date: '2024-01-01' };
      const html = dialogueService.generateDialogueHtml(scene);
      expect(html).toContain('<strong>Date:</strong> 2024-01-01');
    });
  });

  describe('getSceneById', () => {
    it('returns scene when found', () => {
      const scenes = [{ id: 's1', name: 'Scene 1', era: 'Modern', locationName: 'City' }];
      mockGetAllScenes.mockReturnValue(scenes);
      const scene = dialogueService.getSceneById(testUser, 's1');
      expect(scene).toEqual(scenes[0]);
    });

    it('returns null when not found', () => {
      mockGetAllScenes.mockReturnValue([]);
      const scene = dialogueService.getSceneById(testUser, 'missing');
      expect(scene).toBeNull();
    });
  });

  describe('ensureDialogueFile', () => {
    const sceneId = 's1';
    const sceneName = 'Test Scene';

    beforeEach(() => {
      mockGetAllScenes.mockReturnValue([
        { id: sceneId, name: sceneName, era: 'Modern', locationName: 'City' },
      ]);
    });

    it('creates dialogue file if it does not exist', async () => {
      const result = await dialogueService.ensureDialogueFile(testUser, sceneId);

      expect(result.existed).toBe(false);
      expect(result.path).toBe('Dialogue/Test Scene.html');

      const filePath = path.join(workspaceDir, 'Dialogue', 'Test Scene.html');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('Scene: Test Scene');
      expect(content).toContain('Modern');
    });

    it('is idempotent - does not overwrite existing file', async () => {
      // First call creates the file
      await dialogueService.ensureDialogueFile(testUser, sceneId);

      // Second call should report it already existed
      const result = await dialogueService.ensureDialogueFile(testUser, sceneId);
      expect(result.existed).toBe(true);
      expect(result.path).toBe('Dialogue/Test Scene.html');
    });

    it('throws when scene is not found', async () => {
      mockGetAllScenes.mockReturnValue([]);

      await expect(dialogueService.ensureDialogueFile(testUser, 'missing')).rejects.toThrow('Scene not found');
    });
  });

  describe('readDialogueFile', () => {
    const sceneId = 's1';
    const sceneName = 'Test Scene';

    beforeEach(() => {
      mockGetAllScenes.mockReturnValue([
        { id: sceneId, name: sceneName, era: 'Modern', locationName: 'City' },
      ]);
    });

    it('returns HTML content when file exists', async () => {
      const dialogueDir = path.join(workspaceDir, 'Dialogue');
      fs.mkdirSync(dialogueDir, { recursive: true });
      const filePath = path.join(dialogueDir, `${sceneName}.html`);
      const htmlContent = '<h2>Test</h2><hr><h3>[Alice]</h3><p>Hello</p>';
      fs.writeFileSync(filePath, htmlContent, 'utf-8');

      const result = await dialogueService.readDialogueFile(testUser, sceneId);
      expect(result.html).toBe(htmlContent);
      expect(result.path).toBe(`Dialogue/${sceneName}.html`);
    });

    it('throws when dialogue file does not exist', async () => {
      await expect(dialogueService.readDialogueFile(testUser, sceneId)).rejects.toThrow(
        `Dialogue file not found: ${sceneName}`
      );
    });

    it('throws when scene is not found', async () => {
      mockGetAllScenes.mockReturnValue([]);

      await expect(dialogueService.readDialogueFile(testUser, 'missing')).rejects.toThrow('Scene not found');
    });
  });

  describe('saveDialogueFile', () => {
    const sceneId = 's1';
    const sceneName = 'Test Scene';

    beforeEach(() => {
      mockGetAllScenes.mockReturnValue([
        { id: sceneId, name: sceneName, era: 'Modern', locationName: 'City' },
      ]);
      mockLoadFileMeta.mockReturnValue({ scenes: [] });
    });

    it('writes HTML content to dialogue file', async () => {
      const htmlContent = '<h2>Saved</h2><hr><h3>[Bob]</h3><p>World</p>';

      const result = await dialogueService.saveDialogueFile(testUser, sceneId, htmlContent);
      expect(result.path).toBe(`Dialogue/${sceneName}.html`);

      const filePath = path.join(workspaceDir, 'Dialogue', `${sceneName}.html`);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(htmlContent);
    });

    it('auto-assigns file to scene via addScenesToFile', async () => {
      mockLoadFileMeta.mockReturnValue({ scenes: [] });

      await dialogueService.saveDialogueFile(testUser, sceneId, '<h2>Test</h2>');

      expect(mockAddScenesToFile).toHaveBeenCalledWith(testUser, `Dialogue/${sceneName}.html`, [sceneId]);
    });

    it('does not fail if auto-assignment fails', async () => {
      mockLoadFileMeta.mockReturnValue({ scenes: [] });
      mockAddScenesToFile.mockRejectedValueOnce(new Error('Assignment failed'));

      // Should not throw
      const result = await dialogueService.saveDialogueFile(testUser, sceneId, '<h2>Test</h2>');
      expect(result.path).toBe(`Dialogue/${sceneName}.html`);
    });

    it('throws when scene is not found', async () => {
      mockGetAllScenes.mockReturnValue([]);

      await expect(dialogueService.saveDialogueFile(testUser, 'missing', '<h2>Test</h2>')).rejects.toThrow(
        'Scene not found'
      );
    });

    it('handles scene name with special characters', async () => {
      const specialSceneId = 's2';
      const specialSceneName = 'Scene: With*Special/Chars';
      mockGetAllScenes.mockReturnValue([
        { id: specialSceneId, name: specialSceneName, era: 'Modern', locationName: 'City' },
      ]);
      mockLoadFileMeta.mockReturnValue({ scenes: [] });

      const result = await dialogueService.saveDialogueFile(testUser, specialSceneId, '<h2>Test</h2>');

      // Special chars should be sanitized in the filename
      const sanitizedFileName = dialogueService.sanitizeFileName(specialSceneName);
      expect(result.path).toBe(`Dialogue/${sanitizedFileName}.html`);
      expect(result.path).toBe('Dialogue/Scene_ With_Special_Chars.html');

      // The sanitized file should exist
      const filePath = path.join(workspaceDir, 'Dialogue', sanitizedFileName + '.html');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('getSceneParticipants', () => {
    const sceneId = 's1';

    beforeEach(() => {
      mockGetAllScenes.mockReturnValue([
        { id: sceneId, name: 'Test Scene', era: 'Modern', locationName: 'City' },
      ]);
    });

    it('returns empty array when no participants are assigned', () => {
      const participants = dialogueService.getSceneParticipants(testUser, sceneId);
      expect(participants).toEqual([]);
    });

    it('finds NPC participant assigned to scene', () => {
      const npcDir = path.join(workspaceDir, 'NPCs');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.writeFileSync(path.join(npcDir, 'Alice.html'), '<h2>Alice</h2>');

      mockLoadFileMeta.mockReturnValue({ scenes: [sceneId] });

      const participants = dialogueService.getSceneParticipants(testUser, sceneId);
      expect(participants).toHaveLength(1);
      expect(participants[0]).toEqual({
        name: 'Alice',
        path: 'NPCs/Alice.html',
        type: 'npc',
      });
    });

    it('finds PlayerCharacter participant assigned to scene', () => {
      const pcDir = path.join(workspaceDir, 'PlayerCharacters');
      fs.mkdirSync(pcDir, { recursive: true });
      fs.writeFileSync(path.join(pcDir, 'Hero.html'), '<h2>Hero</h2>');

      mockLoadFileMeta.mockReturnValue({ scenes: [sceneId] });

      const participants = dialogueService.getSceneParticipants(testUser, sceneId);
      expect(participants).toHaveLength(1);
      expect(participants[0]).toEqual({
        name: 'Hero',
        path: 'PlayerCharacters/Hero.html',
        type: 'playercharacter',
      });
    });

    it('finds both NPC and PlayerCharacter participants', () => {
      const npcDir = path.join(workspaceDir, 'NPCs');
      const pcDir = path.join(workspaceDir, 'PlayerCharacters');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.mkdirSync(pcDir, { recursive: true });
      fs.writeFileSync(path.join(npcDir, 'Alice.html'), '<h2>Alice</h2>');
      fs.writeFileSync(path.join(pcDir, 'Hero.html'), '<h2>Hero</h2>');

      mockLoadFileMeta.mockReturnValue({ scenes: [sceneId] });

      const participants = dialogueService.getSceneParticipants(testUser, sceneId);
      expect(participants).toHaveLength(2);
    });

    it('skips Dialogue folder during walk', () => {
      const dialogueDir = path.join(workspaceDir, 'Dialogue');
      fs.mkdirSync(dialogueDir, { recursive: true });
      // Create a file in Dialogue folder that looks like an NPC
      fs.writeFileSync(path.join(dialogueDir, 'Test Scene.html'), '<h2>Dialogue</h2>');

      // Should not find any participants since Dialogue folder is skipped
      const participants = dialogueService.getSceneParticipants(testUser, sceneId);
      expect(participants).toEqual([]);
    });

    it('skips hidden directories', () => {
      const hiddenDir = path.join(workspaceDir, '.__hidden');
      fs.mkdirSync(hiddenDir, { recursive: true });
      fs.writeFileSync(path.join(hiddenDir, 'Secret.html'), '<h2>Secret</h2>');

      const participants = dialogueService.getSceneParticipants(testUser, sceneId);
      expect(participants).toEqual([]);
    });

    it('skips files not assigned to the scene', () => {
      const npcDir = path.join(workspaceDir, 'NPCs');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.writeFileSync(path.join(npcDir, 'Bob.html'), '<h2>Bob</h2>');

      // File is not assigned to this scene
      mockLoadFileMeta.mockReturnValue({ scenes: ['other-scene'] });

      const participants = dialogueService.getSceneParticipants(testUser, sceneId);
      expect(participants).toEqual([]);
    });

    it('skips files with invalid meta', () => {
      const npcDir = path.join(workspaceDir, 'NPCs');
      fs.mkdirSync(npcDir, { recursive: true });
      fs.writeFileSync(path.join(npcDir, 'Bad.html'), '<h2>Bad</h2>');

      mockLoadFileMeta.mockImplementation(() => {
        throw new Error('Invalid meta');
      });

      // Should not throw, should gracefully skip
      const participants = dialogueService.getSceneParticipants(testUser, sceneId);
      expect(participants).toEqual([]);
    });

    it('returns empty array when scene is not found', () => {
      mockGetAllScenes.mockReturnValue([]);

      const participants = dialogueService.getSceneParticipants(testUser, 'missing');
      expect(participants).toEqual([]);
    });
  });
});