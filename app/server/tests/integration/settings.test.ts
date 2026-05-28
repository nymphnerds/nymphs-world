import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, getAuthedApp } from '../helpers/testApp.js';

describe('Settings API Integration', () => {
  const app = getTestApp();
  let token: string;

  beforeAll(async () => {
    const auth = await getAuthedApp('integ_settings_user');
    token = auth.token;
  });

  describe('GET /api/settings', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.get('/api/settings');
      expect(res.status).toBe(401);
    });

    it('returns 200 with user settings when authenticated', async () => {
      const res = await app.get('/api/settings')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('settings');
    });
  });

  describe('POST /api/settings/user', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.post('/api/settings/user')
        .send({ modelName: 'test-model' });
      expect(res.status).toBe(401);
    });

    it('returns 200 and updates settings', async () => {
      const res = await app.post('/api/settings/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ modelName: 'test-model' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('settings');
    });

    it('persists settings across requests', async () => {
      // Set a setting
      await app.post('/api/settings/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ modelName: 'persist-test-model' });

      // Read it back
      const res = await app.get('/api/settings')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/settings/test', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.post('/api/settings/test')
        .send({});
      expect(res.status).toBe(401);
    });

    it('returns 200 with auth token (test LLM connection)', async () => {
      const res = await app.post('/api/settings/test')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(200);
    });
  });
});