import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/services/authService.js';

/**
 * Generates a valid JWT token for the given username.
 * Used in unit tests to avoid calling the HTTP endpoint.
 */
export function generateTestToken(username: string): string {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Generates an expired JWT token for testing expired token rejection.
 */
export function generateExpiredToken(username: string): string {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '0s' });
}

/**
 * Generates a token with a tampered payload (invalid signature).
 */
export function generateTamperedToken(username: string): string {
  return jwt.sign({ username }, 'wrong-secret', { expiresIn: '7d' });
}