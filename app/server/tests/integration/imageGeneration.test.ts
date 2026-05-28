import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, getAuthedApp } from '../helpers/testApp.js';

describe('Image Generation API Integration', () => {
  const app = getTestApp();
  let token: string;

  beforeAll(async () => {
    const auth = await getAuthedApp('integ_image_user');
    token = auth.token;
  });

  describe('GET /api/llm/image-generation/status', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.get('/api/llm/image-generation/status');
      expect(res.status).toBe(401);
    });

    it('returns 200 with auth token', async () => {
      const res = await app.get('/api/llm/image-generation/status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('running');
    });
  });

  describe('GET /api/llm/image-generation/progress', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.get('/api/llm/image-generation/progress');
      expect(res.status).toBe(401);
    });

    it('returns 200 with auth token', async () => {
      const res = await app.get('/api/llm/image-generation/progress')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/llm/image-generation/test', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.post('/api/llm/image-generation/test')
        .send({});
      expect(res.status).toBe(401);
    });

    it('returns 200 with auth token (test connection)', async () => {
      const res = await app.post('/api/llm/image-generation/test')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/llm/generate-image', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.post('/api/llm/generate-image')
        .send({ prompt: 'test' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when prompt is missing', async () => {
      const res = await app.post('/api/llm/generate-image')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});