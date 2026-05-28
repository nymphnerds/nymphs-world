import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApp, getAuthedApp } from '../helpers/testApp.js';
import { generateExpiredToken } from '../helpers/authHelper.js';

describe('Auth API Integration', () => {
  const app = getTestApp();

  describe('POST /api/auth/login', () => {
    it('returns 200 with token and user for valid username', async () => {
      const res = await app.post('/api/auth/login').send({
        username: 'integ_login_user',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe('integ_login_user');
    });

    it('returns existing user on second login (isNewUser false)', async () => {
      // First login (creates user)
      await app.post('/api/auth/login').send({ username: 'integ_second_login' });
      // Second login
      const res = await app.post('/api/auth/login').send({ username: 'integ_second_login' });

      expect(res.status).toBe(200);
      expect(res.body.user.isNewUser).toBe(false);
    });

    it('returns 400 for missing username', async () => {
      const res = await app.post('/api/auth/login').send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 for empty username string', async () => {
      const res = await app.post('/api/auth/login').send({ username: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/check', () => {
    it('returns { exists: true } for registered user', async () => {
      // First login to create user
      await app.post('/api/auth/login').send({ username: 'integ_check_user' });
      // Then check
      const res = await app.post('/api/auth/check').send({ username: 'integ_check_user' });

      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(true);
    });

    it('returns { exists: false } for non-existent user', async () => {
      const res = await app.post('/api/auth/check').send({ username: 'nonexistent_user_x_y_z' });

      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(false);
    });

    it('returns 400 for missing username', async () => {
      const res = await app.post('/api/auth/check').send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 200 and user info with valid token', async () => {
      const { token } = await getAuthedApp('integ_me_user');

      const res = await app.get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe('integ_me_user');
    });

    it('returns 401 without auth token', async () => {
      const res = await app.get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('returns 401 with expired token', async () => {
      const expiredToken = generateExpiredToken('integ_me_user');

      const res = await app.get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/health', () => {
    it('returns 200 without auth (public endpoint)', async () => {
      const res = await app.get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  describe('Protected route access (files)', () => {
    let authToken: string;

    beforeAll(async () => {
      const { token } = await getAuthedApp('integ_protected_user');
      authToken = token;
    });

    it('returns 401 for protected route without token', async () => {
      const res = await app.get('/api/files/?path=');

      expect(res.status).toBe(401);
    });

    it('returns 200 for protected route with valid token', async () => {
      const res = await app.get('/api/files/?path=')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 401 for protected route with expired token', async () => {
      const expiredToken = generateExpiredToken('integ_protected_user');

      const res = await app.get('/api/files/?path=')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });
  });
});