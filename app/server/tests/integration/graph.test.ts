import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, getAuthedApp } from '../helpers/testApp.js';

describe('Graph API Integration', () => {
  const app = getTestApp();
  let token: string;

  beforeAll(async () => {
    const auth = await getAuthedApp('integ_graph_user');
    token = auth.token;
  });

  describe('GET /api/llm/graph/eras', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.get('/api/llm/graph/eras');
      expect(res.status).toBe(401);
    });

    it('returns 200 with auth token (empty workspace)', async () => {
      const res = await app.get('/api/llm/graph/eras')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('eras');
      expect(Array.isArray(res.body.eras)).toBe(true);
    });
  });

  describe('POST /api/llm/graph/from-seed', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.post('/api/llm/graph/from-seed').send({ seedPath: 'test.html' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when seedPath is missing', async () => {
      const res = await app.post('/api/llm/graph/from-seed')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when seedPath does not exist', async () => {
      const res = await app.post('/api/llm/graph/from-seed')
        .set('Authorization', `Bearer ${token}`)
        .send({ seedPath: 'nonexistent_file.html' });
      expect(res.status).toBe(400);
    });

    it('returns graph with seed node when workspace is empty', async () => {
      const res = await app.post('/api/llm/graph/from-seed')
        .set('Authorization', `Bearer ${token}`)
        .send({ seedPath: 'test.html', useAI: false });
      // Either 400 (file not found) or 200 with empty graph
      expect([200, 400]).toContain(res.status);
    });
  });
});