import { describe, it, expect, beforeEach, vi } from 'vitest';
import authMiddleware from '../../../src/middleware/authMiddleware.js';
import { generateTestToken, generateExpiredToken, generateTamperedToken } from '../../helpers/authHelper.js';

describe('authMiddleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined,
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('calls next() and attaches user for valid Bearer token', () => {
    const token = generateTestToken('testuser');
    mockReq.headers['authorization'] = `Bearer ${token}`;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockReq.user).toBeDefined();
    expect(mockReq.user.username).toBe('testuser');
  });

  it('calls next() for valid token without Bearer prefix', () => {
    const token = generateTestToken('baretoken');
    mockReq.headers['authorization'] = token;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user.username).toBe('baretoken');
  });

  it('returns 401 for missing Authorization header', () => {
    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 401 for empty Authorization header', () => {
    mockReq.headers['authorization'] = '';

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for "Bearer " with no token after it', () => {
    mockReq.headers['authorization'] = 'Bearer ';

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for expired token', () => {
    const token = generateExpiredToken('testuser');
    mockReq.headers['authorization'] = `Bearer ${token}`;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 401 for tampered token (invalid signature)', () => {
    const token = generateTamperedToken('testuser');
    mockReq.headers['authorization'] = `Bearer ${token}`;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 401 for malformed token string', () => {
    mockReq.headers['authorization'] = 'Bearer not-a-valid-jwt-token';

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});