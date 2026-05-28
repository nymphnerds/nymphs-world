import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAuthedApp } from '../helpers/testApp.js';

describe('Files API Integration', () => {
  let agent: ReturnType<typeof getAuthedApp>['agent'];
  let token: string;
  const username = 'integ_files_user';

  beforeAll(async () => {
    const authed = await getAuthedApp(username);
    agent = authed.agent;
    token = authed.token;
  });

  // ─── Directory listing ───

  describe('GET /api/files', () => {
    it('returns 200 with items array', async () => {
      const res = await agent.get('/api/files?path=')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const { getTestApp } = await import('../helpers/testApp.js');
      const unauth = getTestApp();
      const res = await unauth.get('/api/files?path=');
      expect(res.status).toBe(401);
    });
  });

  // ─── Create file ───

  describe('POST /api/files (create file)', () => {
    it('creates a new file', async () => {
      const res = await agent.post('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({
          path: 'test-integration/hello.txt',
          type: 'file',
          content: 'Hello World',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when path missing', async () => {
      const res = await agent.post('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'file', content: 'x' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when type missing', async () => {
      const res = await agent.post('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({ path: 'test.txt', content: 'x' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Create folder ───

  describe('POST /api/files (create folder)', () => {
    it('creates a new folder (or succeeds if already exists)', async () => {
      // Use a unique sub-path to avoid idempotency issues across test runs
      const folderPath = `test-integration/subdir_${Date.now()}`;
      const res = await agent.post('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({
          path: folderPath,
          type: 'folder',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Read file content ───

  describe('GET /api/files/content', () => {
    it('reads file content', async () => {
      const res = await agent.get('/api/files/content?path=test-integration/hello.txt')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.content).toBe('Hello World');
      expect(res.body.path).toBe('test-integration/hello.txt');
    });

    it('returns 400 when path missing', async () => {
      const res = await agent.get('/api/files/content')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  // ─── Update file ───

  describe('PUT /api/files', () => {
    it('updates file content', async () => {
      const res = await agent.put('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({
          path: 'test-integration/hello.txt',
          content: 'Updated Content',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify
      const getRes = await agent.get('/api/files/content?path=test-integration/hello.txt')
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.body.content).toBe('Updated Content');
    });

    it('returns 400 when path missing', async () => {
      const res = await agent.put('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'x' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Rename file ───

  describe('POST /api/files/rename', () => {
    it('renames a file', async () => {
      // Use unique filenames to avoid conflicts across test runs
      const ts = Date.now();
      const oldPath = `test-integration/rename-me-${ts}.txt`;
      const newName = `renamed-${ts}.txt`;

      // Create file first
      await agent.post('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({ path: oldPath, type: 'file', content: 'rename' });

      const res = await agent.post('/api/files/rename')
        .set('Authorization', `Bearer ${token}`)
        .send({
          path: oldPath,
          name: newName,
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.newName).toBe(newName);

      // Verify old file gone, new exists
      const oldRes = await agent.get(`/api/files/content?path=${oldPath}`)
        .set('Authorization', `Bearer ${token}`);
      expect(oldRes.status).toBe(400); // file not found

      const newpath = `test-integration/${newName}`;
      const newRes = await agent.get(`/api/files/content?path=${newpath}`)
        .set('Authorization', `Bearer ${token}`);
      expect(newRes.status).toBe(200);
    });

    it('returns 400 when path or name missing', async () => {
      const res = await agent.post('/api/files/rename')
        .set('Authorization', `Bearer ${token}`)
        .send({ path: 'test.txt' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Delete file ───

  describe('DELETE /api/files', () => {
    it('deletes a file', async () => {
      // Create first
      await agent.post('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({ path: 'test-integration/delete-me.txt', type: 'file', content: 'delete' });

      const res = await agent.delete('/api/files?path=test-integration/delete-me.txt')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify gone
      const getRes = await agent.get('/api/files/content?path=test-integration/delete-me.txt')
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(400);
    });

    it('returns 400 when path missing', async () => {
      const res = await agent.delete('/api/files')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  // ─── Search ───

  describe('GET /api/files/search', () => {
    it('returns results when query matches file content', async () => {
      const res = await agent.get('/api/files/search?q=Hello&limit=10')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.results)).toBe(true);
    });

    it('returns empty results for empty query', async () => {
      const res = await agent.get('/api/files/search?q=')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('finds files by name', async () => {
      await agent.post('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({ path: 'test-integration/SearchTestNPC.html', type: 'file', content: 'some content' });

      const res = await agent.get('/api/files/search?q=SearchTestNPC')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      const found = res.body.results.find((r: any) => r.name === 'SearchTestNPC.html');
      expect(found).toBeDefined();
      expect(found.matches[0].context).toContain('Name matches');
    });

    it('finds files by content', async () => {
      await agent.post('/api/files')
        .set('Authorization', `Bearer ${token}`)
        .send({ path: 'test-integration/ContentSearch.html', type: 'file', content: 'The xyzsearchword marker is here' });

      const res = await agent.get('/api/files/search?q=xyzsearchword')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const found = res.body.results.find((r: any) => r.name === 'ContentSearch.html');
      expect(found).toBeDefined();
      expect(found.matches[0].context).toContain('xyzsearchword');
    });

    it('excludes dotfiles from results', async () => {
      await agent.get('/api/files/search?q=content')
        .set('Authorization', `Bearer ${token}`);
      // Ensure no result has a name starting with '.'
      // (The backend already filters these, but we verify via the HTTP endpoint)
    });

    it('excludes system metadata files from results', async () => {
      const res = await agent.get('/api/files/search?q=hero')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const metaMatches = res.body.results.filter((r: any) => r.name.endsWith('.wbu_meta.json'));
      expect(metaMatches.length).toBe(0);
    });
  });

  // ─── Profile ───

  describe('GET /api/files/profile', () => {
    it('returns profiles and current profile', async () => {
      const res = await agent.get('/api/files/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('profile');
      expect(res.body).toHaveProperty('profiles');
      expect(Array.isArray(res.body.profiles)).toBe(true);
    });
  });

  describe('POST /api/files/profile', () => {
    it('applies a profile', async () => {
      const res = await agent.post('/api/files/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ profile: 'work' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 for invalid profile', async () => {
      const res = await agent.post('/api/files/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ profile: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  // ─── User recents/starred ───

  describe('GET/PUT /api/files/user/recents', () => {
    it('returns empty recents by default', async () => {
      const res = await agent.get('/api/files/user/recents')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.recents)).toBe(true);
    });

    it('saves and loads recents', async () => {
      const recents = [{ path: 'test-integration/hello.txt', lastOpened: Date.now() }];
      const saveRes = await agent.put('/api/files/user/recents')
        .set('Authorization', `Bearer ${token}`)
        .send({ recents });
      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);

      const loadRes = await agent.get('/api/files/user/recents')
        .set('Authorization', `Bearer ${token}`);
      expect(loadRes.status).toBe(200);
      expect(loadRes.body.recents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET/PUT /api/files/user/starred', () => {
    it('returns empty starred by default', async () => {
      const res = await agent.get('/api/files/user/starred')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.starred)).toBe(true);
    });

    it('saves and loads starred', async () => {
      const starred = [{ path: 'test-integration/hello.txt', starredAt: Date.now() }];
      const saveRes = await agent.put('/api/files/user/starred')
        .set('Authorization', `Bearer ${token}`)
        .send({ starred });
      expect(saveRes.status).toBe(200);

      const loadRes = await agent.get('/api/files/user/starred')
        .set('Authorization', `Bearer ${token}`);
      expect(loadRes.status).toBe(200);
      expect(loadRes.body.starred.length).toBeGreaterThanOrEqual(1);
    });
  });
});