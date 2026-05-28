import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getTestApp, getAuthedApp } from '../helpers/testApp.js';

// Mock authService to use temp workspace
vi.mock('../../../src/services/authService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/authService.js')>();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worbi-dialogue-int-'));

  return {
    ...actual,
    getUserWorkspaceDir: (username: string) => {
      const dir = path.join(tempRoot, username, 'workspace');
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    },
    getUserAssetsDir: (username: string) => {
      const dir = path.join(tempRoot, username, 'assets');
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    },
    _tempRoot: tempRoot,
  };
});

import * as authService from '../../src/services/authService.js';

describe('Dialogue API', () => {
  const app = getTestApp();
  let token = '';
  const username = 'dialoguetest';
  let workspaceDir = '';
  let sceneId = '';

  beforeAll(async () => {
    const { token: t } = await getAuthedApp(username);
    token = t;
    workspaceDir = authService.getUserWorkspaceDir(username);

    // Clean workspace to ensure fresh state (temp dir may persist between runs)
    fs.rmSync(workspaceDir, { recursive: true, force: true });
    fs.mkdirSync(workspaceDir, { recursive: true });

    // Create scene registry (.__wbu_scenes.json is what getAllScenes reads)
    sceneId = 'test_scene_1';
    const sceneRegistry = {
      scenes: [
        {
          id: sceneId,
          name: 'Test Scene',
          era: 'Modern Era',
          locationName: 'Test City',
          date: '2024-06-15',
        },
      ],
    };
    fs.writeFileSync(
      path.join(workspaceDir, '.__wbu_scenes.json'),
      JSON.stringify(sceneRegistry, null, 2),
      'utf-8'
    );
  });

  afterAll(() => {
    // Cleanup temp directory
    const tempRoot = (authService as any)._tempRoot;
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  describe('POST /api/dialogue/:sceneId/ensure', () => {
    it('returns 401 without auth', async () => {
      const res = await app.post(`/api/dialogue/${sceneId}/ensure`);
      expect(res.status).toBe(401);
    });

    it('creates dialogue file and returns path with auth', async () => {
      const res = await app
        .post(`/api/dialogue/${sceneId}/ensure`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.path).toContain('Dialogue/');
      expect(res.body.existed).toBe(false);

      // Verify file was created on disk
      const filePath = path.join(workspaceDir, 'Dialogue', 'Test Scene.html');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('is idempotent - second call reports existed=true', async () => {
      const res = await app
        .post(`/api/dialogue/${sceneId}/ensure`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.existed).toBe(true);
    });

    it('returns 404 for non-existent scene', async () => {
      const res = await app
        .post('/api/dialogue/missing_scene_123/ensure')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('GET /api/dialogue/:sceneId', () => {
    it('returns 401 without auth', async () => {
      const res = await app.get(`/api/dialogue/${sceneId}`);
      expect(res.status).toBe(401);
    });

    it('returns dialogue HTML and participants with auth', async () => {
      const res = await app
        .get(`/api/dialogue/${sceneId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.html).toContain('Test Scene');
      expect(res.body.path).toContain('Dialogue/');
      expect(Array.isArray(res.body.participants)).toBe(true);
    });

    it('returns 404 when dialogue file does not exist', async () => {
      // Create a new scene without dialogue file
      const missingSceneId = 'no_dialogue_scene';
      const registry = JSON.parse(fs.readFileSync(path.join(workspaceDir, '.__wbu_scenes.json'), 'utf-8'));
      registry.scenes.push({
        id: missingSceneId,
        name: 'No Dialogue',
        era: 'Modern',
        locationName: 'Nowhere',
        date: '',
      });
      fs.writeFileSync(
        path.join(workspaceDir, '.__wbu_scenes.json'),
        JSON.stringify(registry, null, 2),
        'utf-8'
      );

      const res = await app
        .get(`/api/dialogue/${missingSceneId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('returns 404 for non-existent scene', async () => {
      const res = await app
        .get('/api/dialogue/missing_scene_456')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/dialogue/:sceneId', () => {
    it('returns 401 without auth', async () => {
      const res = await app.post(`/api/dialogue/${sceneId}`).send({ html: '<h2>Test</h2>' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when html is missing', async () => {
      const res = await app
        .post(`/api/dialogue/${sceneId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('html');
    });

    it('saves dialogue HTML with auth', async () => {
      const newHtml = '<h2>Scene: Test Scene</h2><hr><h3>[Alice]</h3><p>Hello world!</p><p><em>She waves</em></p>';

      const res = await app
        .post(`/api/dialogue/${sceneId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ html: newHtml });

      expect(res.status).toBe(200);
      expect(res.body.path).toContain('Dialogue/');

      // Verify file was written
      const filePath = path.join(workspaceDir, 'Dialogue', 'Test Scene.html');
      const savedContent = fs.readFileSync(filePath, 'utf-8');
      expect(savedContent).toBe(newHtml);
    });

    it('returns 404 for non-existent scene', async () => {
      const res = await app
        .post('/api/dialogue/missing_scene_789')
        .set('Authorization', `Bearer ${token}`)
        .send({ html: '<h2>Test</h2>' });

      expect(res.status).toBe(404);
    });
  });

  describe('E2E: Ensure -> Read -> Write -> Read cycle', () => {
    it('full lifecycle works end-to-end', async () => {
      // Create a fresh scene in the registry
      const e2eSceneId = 'e2e_scene';
      const e2eSceneName = 'E2E Scene';
      const registry = JSON.parse(fs.readFileSync(path.join(workspaceDir, '.__wbu_scenes.json'), 'utf-8'));
      registry.scenes.push({
        id: e2eSceneId,
        name: e2eSceneName,
        era: 'Future',
        locationName: 'Space Station',
        date: '',
      });
      fs.writeFileSync(
        path.join(workspaceDir, '.__wbu_scenes.json'),
        JSON.stringify(registry, null, 2),
        'utf-8'
      );

      // 1. Ensure
      const ensureRes = await app
        .post(`/api/dialogue/${e2eSceneId}/ensure`)
        .set('Authorization', `Bearer ${token}`);
      expect(ensureRes.status).toBe(200);
      expect(ensureRes.body.existed).toBe(false);

      // 2. Read (should have auto-generated header)
      const readRes1 = await app
        .get(`/api/dialogue/${e2eSceneId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(readRes1.status).toBe(200);
      expect(readRes1.body.html).toContain('E2E Scene');
      expect(readRes1.body.html).toContain('Future');

      // 3. Write dialogue content
      const dialogueHtml = `<!-- Build: Yes -->
<!-- Template: Dialogue -->
<h2>Scene: ${e2eSceneName}</h2>
<p><strong>Era:</strong> Future | <strong>Location:</strong> Space Station</p>
<hr>
<h3>[Commander]</h3>
<p>All hands on deck!</p>
<p><em>The ship shakes violently</em></p>
<h3>[Engineer]</h3>
<p>Engines at maximum!</p>`;

      const writeRes = await app
        .post(`/api/dialogue/${e2eSceneId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ html: dialogueHtml });
      expect(writeRes.status).toBe(200);

      // 4. Read back and verify
      const readRes2 = await app
        .get(`/api/dialogue/${e2eSceneId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(readRes2.status).toBe(200);
      expect(readRes2.body.html).toContain('All hands on deck!');
      expect(readRes2.body.html).toContain('The ship shakes violently');
      expect(readRes2.body.html).toContain('Engines at maximum');
    });
  });
});