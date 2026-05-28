import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, getAuthedApp } from '../helpers/testApp.js';

describe('Timeline API Integration', () => {
  const app = getTestApp();
  let token: string;

  beforeAll(async () => {
    const auth = await getAuthedApp('integ_timeline_user');
    token = auth.token;
  });

  describe('GET /api/files/timeline', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.get('/api/files/timeline');
      expect(res.status).toBe(401);
    });

    it('returns 200 with eras array when authenticated', async () => {
      const res = await app.get('/api/files/timeline')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('eras');
      expect(Array.isArray(res.body.eras)).toBe(true);
    });
  });

  describe('GET /api/files/timeline/suggest-date', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.get('/api/files/timeline/suggest-date?era=Test');
      expect(res.status).toBe(401);
    });

    it('returns suggested date for era', async () => {
      const res = await app.get('/api/files/timeline/suggest-date?era=Test+Era')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('suggestedDate');
    });
  });

  describe('PUT /api/files/timeline/metadata', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.put('/api/files/timeline/metadata')
        .send({ filePath: 'test.html', metadata: { era: 'Test' } });
      expect(res.status).toBe(401);
    });

    it('returns 400 when filePath or metadata missing', async () => {
      const res = await app.put('/api/files/timeline/metadata')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('persists and retrieves timeline metadata', async () => {
      const putRes = await app.put('/api/files/timeline/metadata')
        .set('Authorization', `Bearer ${token}`)
        .send({
          filePath: 'test_timeline_file.html',
          metadata: { era: 'First Age', date: '1', title: 'Test Event' },
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body).toHaveProperty('ok', true);
    });
  });
});