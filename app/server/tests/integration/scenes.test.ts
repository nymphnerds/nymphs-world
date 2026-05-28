import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import expressApp from '../../src/index.js';
import { getAuthedApp } from '../helpers/testApp.js';

// Locate the test user's scene registry file so we can wipe it before each run.
// authService.js: usersRoot = path.join(__dirname, '..', 'data', 'users')
// sceneService.js: workspace = path.join(usersRoot, username, 'workspace')
// registry file: <workspace>/.__wbu_scenes.json
function getTestScenesFile() {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const usersRoot = path.join(projectRoot, 'src', 'data', 'users');
  return path.join(usersRoot, 'integ_scene_user', 'workspace', '.__wbu_scenes.json');
}

describe('Scenes API Integration', () => {
  const testUser = 'integ_scene_user';
  let token: string;

  beforeAll(async () => {
    // Wipe scene registry from previous test runs to ensure test isolation
    const scenesFile = getTestScenesFile();
    if (fs.existsSync(scenesFile)) {
      fs.unlinkSync(scenesFile);
    }
    const authed = await getAuthedApp(testUser);
    token = authed.token;
  });

  afterAll(() => {
    // Cleanup: remove scene registry after all tests complete
    const scenesFile = getTestScenesFile();
    if (fs.existsSync(scenesFile)) {
      try { fs.unlinkSync(scenesFile); } catch { /* ignore */ }
    }
  });

  describe('GET /api/files/scenes', () => {
    it('returns 401 without auth', async () => {
      const res = await request(expressApp).get('/api/files/scenes');
      expect(res.status).toBe(401);
    });

    it('returns 200 with auth, empty array initially', async () => {
      const res = await request(expressApp)
        .get('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.scenes).toEqual([]);
    });

    it('returns 200 with scenes after creating', async () => {
      await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Integration Cave',
          era: 'Year 1',
          date: 'Spring',
          locationName: 'Dungeon',
        });

      const res = await request(expressApp)
        .get('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.scenes.length).toBeGreaterThanOrEqual(1);
      const found = res.body.scenes.find((s: any) => s.name === 'Integration Cave');
      expect(found).toBeDefined();
      expect(found.era).toBe('Year 1');
    });
  });

  describe('POST /api/files/scenes', () => {
    it('returns 401 without auth', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes')
        .send({
          name: 'Unauth Scene',
          era: 'Year 1',
          locationName: 'Dungeon',
        });
      expect(res.status).toBe(401);
    });

    it('creates scene with all fields', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Village Square',
          era: 'Year 2',
          date: 'Summer',
          locationName: 'Village',
        });
      expect(res.status).toBe(200);
      expect(res.body.scene.name).toBe('Village Square');
      expect(res.body.scene.era).toBe('Year 2');
      expect(res.body.scene.date).toBe('Summer');
      expect(res.body.scene.locationName).toBe('Village');
      expect(res.body.scene.id).toMatch(/^scene_/);
    });

    it('returns 400 on missing name', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          era: 'Year 1',
          locationName: 'Dungeon',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Scene name is required');
    });

    it('returns 400 on missing era', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'No Era Scene',
          locationName: 'Dungeon',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Era is required');
    });

    it('returns 400 on missing locationName', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'No Location Scene',
          era: 'Year 1',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Location is required');
    });

    it('returns 409 on duplicate name', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Village Square',
          era: 'Year 3',
          locationName: 'Castle',
        });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('PUT /api/files/scenes/:id', () => {
    let sceneId: string;

    beforeAll(async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updatable Scene',
          era: 'Year 1',
          date: '',
          locationName: 'Dungeon',
        });
      sceneId = res.body.scene.id;
    });

    it('returns 401 without auth', async () => {
      const res = await request(expressApp)
        .put(`/api/files/scenes/${sceneId}`)
        .send({ name: 'Hacked' });
      expect(res.status).toBe(401);
    });

    it('updates scene', async () => {
      const res = await request(expressApp)
        .put(`/api/files/scenes/${sceneId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Renamed Scene',
          era: 'Year 5',
          date: 'Autumn',
          locationName: 'Castle',
        });
      expect(res.status).toBe(200);
      expect(res.body.scene.name).toBe('Renamed Scene');
      expect(res.body.scene.era).toBe('Year 5');
      expect(res.body.scene.date).toBe('Autumn');
      expect(res.body.scene.locationName).toBe('Castle');
    });

    it('returns 404 on non-existent ID', async () => {
      const res = await request(expressApp)
        .put('/api/files/scenes/scene_nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X' });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('returns 409 on duplicate name', async () => {
      const createRes = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Other Scene',
          era: 'Year 1',
          locationName: 'Village',
        });
      const otherId = createRes.body.scene.id;

      const res = await request(expressApp)
        .put(`/api/files/scenes/${otherId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed Scene' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('DELETE /api/files/scenes/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(expressApp).delete('/api/files/scenes/scene_nonexistent');
      expect(res.status).toBe(401);
    });

    it('deletes scene', async () => {
      const createRes = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'ToDelete Scene',
          era: 'Year 1',
          locationName: 'Dungeon',
        });
      const sceneId = createRes.body.scene.id;

      const res = await request(expressApp)
        .delete(`/api/files/scenes/${sceneId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone
      const getRes = await request(expressApp)
        .get('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`);
      const found = getRes.body.scenes.find((s: any) => s.id === sceneId);
      expect(found).toBeUndefined();
    });

    it('returns 404 on non-existent ID', async () => {
      const res = await request(expressApp)
        .delete('/api/files/scenes/scene_nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('GET /api/files/scenes/file/:filePath(*)', () => {
    it('returns 401 without auth', async () => {
      const res = await request(expressApp).get('/api/files/scenes/file/test.html');
      expect(res.status).toBe(401);
    });

    it('returns empty array for new file', async () => {
      const res = await request(expressApp)
        .get('/api/files/scenes/file/newFile.html')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.scenes).toEqual([]);
    });

    it('returns scene IDs after assignment', async () => {
      const createRes = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'File Scene',
          era: 'Year 1',
          locationName: 'Dungeon',
        });
      const sceneId = createRes.body.scene.id;

      await request(expressApp)
        .post('/api/files/scenes/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: 'adventure.html',
          sceneIds: [sceneId],
        });

      const res = await request(expressApp)
        .get('/api/files/scenes/file/adventure.html')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.scenes).toContain(sceneId);
    });
  });

  describe('POST /api/files/scenes/assign', () => {
    it('returns 401 without auth', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes/assign')
        .send({
          filePath: 'test.html',
          sceneIds: ['scene_x'],
        });
      expect(res.status).toBe(401);
    });

    it('assigns scene to file', async () => {
      const createRes = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Assign Scene',
          era: 'Year 1',
          locationName: 'Village',
        });
      const sceneId = createRes.body.scene.id;

      const res = await request(expressApp)
        .post('/api/files/scenes/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: 'story.html',
          sceneIds: [sceneId],
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.added).toContain(sceneId);
    });

    it('returns 400 on missing filePath', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({ sceneIds: ['scene_x'] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 on missing sceneIds', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({ filePath: 'test.html' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 on non-existent scene ID', async () => {
      const res = await request(expressApp)
        .post('/api/files/scenes/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: 'test.html',
          sceneIds: ['scene_nonexistent_999'],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/does not exist/i);
    });
  });

  describe('DELETE /api/files/scenes/file/:filePath*/:sceneId', () => {
    it('returns 401 without auth', async () => {
      const res = await request(expressApp).delete('/api/files/scenes/file/test.html/scene_x');
      expect(res.status).toBe(401);
    });

    it('removes scene from file', async () => {
      const createRes = await request(expressApp)
        .post('/api/files/scenes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Remove Scene',
          era: 'Year 1',
          locationName: 'Dungeon',
        });
      const sceneId = createRes.body.scene.id;

      await request(expressApp)
        .post('/api/files/scenes/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: 'removeTest.html',
          sceneIds: [sceneId],
        });

      // Verify assigned
      let getRes = await request(expressApp)
        .get('/api/files/scenes/file/removeTest.html')
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.body.scenes).toContain(sceneId);

      // Remove
      const res = await request(expressApp)
        .delete(`/api/files/scenes/file/removeTest.html/${sceneId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.removed).toBe(sceneId);

      // Verify removed
      getRes = await request(expressApp)
        .get('/api/files/scenes/file/removeTest.html')
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.body.scenes).not.toContain(sceneId);
    });
  });
});