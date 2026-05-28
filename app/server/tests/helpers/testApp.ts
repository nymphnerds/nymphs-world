import request from 'supertest';
import app from '../../src/index.js';

/**
 * Returns a supertest agent bound to the Express app.
 * The app does NOT listen on a port (NODE_ENV=test prevents this).
 */
export function getTestApp() {
  return request(app);
}

/**
 * Logs in (or creates) a test user via the username-only auth endpoint
 * and returns a supertest agent pre-authenticated with a valid JWT token.
 */
export async function getAuthedApp(username: string = 'testuser') {
  // Login or create user (WORBI uses passwordless username-only auth)
  const res = await request(app).post('/api/auth/login').send({ username });
  const token = res.body.token;

  // Return a supertest agent that includes the auth header
  const agent = request(app);
  return { agent, token };
}