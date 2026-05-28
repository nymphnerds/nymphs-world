import { describe, it, expect } from 'vitest';
import { loginOrCreate, verifyToken, getUserWorkspaceDir, getUserSettingsPath, getUserAssetsDir } from '../../../src/services/authService.js';
import { generateTestToken, generateExpiredToken, generateTamperedToken } from '../../helpers/authHelper.js';

describe('authService.loginOrCreate()', () => {
  it('creates a new user and returns user object', () => {
    const result = loginOrCreate('test_svc_newuser');
    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.username).toBe('test_svc_newuser');
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('dirs');
  });

  it('returns existing user on subsequent call', () => {
    loginOrCreate('test_svc_existing');
    const result = loginOrCreate('test_svc_existing');
    expect(result.user.username).toBe('test_svc_existing');
    expect(result.user.isNewUser).toBe(false);
  });

  it('throws for missing username', () => {
    expect(() => loginOrCreate('')).toThrow();
  });

  it('throws for username too short', () => {
    expect(() => loginOrCreate('a')).toThrow();
  });

  it('throws for username too long', () => {
    expect(() => loginOrCreate('a'.repeat(31))).toThrow();
  });

  it('throws for username with invalid characters', () => {
    expect(() => loginOrCreate('user name!')).toThrow();
  });

  it('returns JWT token', () => {
    const result = loginOrCreate('test_svc_tokenuser');
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(10);
  });

  it('returns dirs with workspaceDir', () => {
    const result = loginOrCreate('test_svc_dirs');
    expect(result.dirs).toBeDefined();
    expect(result.dirs.workspaceDir).toBeDefined();
    expect(result.dirs.workspaceDir).toContain('workspace');
  });
});

describe('authService.verifyToken()', () => {
  it('returns valid for valid token', () => {
    const token = generateTestToken('testuser');
    const result = verifyToken(token);
    expect(result.valid).toBe(true);
    expect(result.username).toBe('testuser');
  });

  it('returns invalid for expired token', () => {
    const token = generateExpiredToken('testuser');
    const result = verifyToken(token);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for tampered token', () => {
    const token = generateTamperedToken('testuser');
    const result = verifyToken(token);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for empty token', () => {
    const result = verifyToken('');
    expect(result.valid).toBe(false);
  });

  it('returns invalid for null token', () => {
    const result = verifyToken(null as any);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for malformed token string', () => {
    const result = verifyToken('not-a-valid-jwt');
    expect(result.valid).toBe(false);
  });
});

describe('authService.getUserWorkspaceDir()', () => {
  it('returns correct workspace path for user', () => {
    const dir = getUserWorkspaceDir('testuser');
    expect(dir).toContain('testuser');
    expect(dir).toContain('workspace');
  });
});

describe('authService.getUserSettingsPath()', () => {
  it('returns correct settings path for user', () => {
    const p = getUserSettingsPath('testuser');
    expect(p).toContain('testuser');
    expect(p).toContain('settings');
  });
});

describe('authService.getUserAssetsDir()', () => {
  it('returns correct assets path for user', () => {
    const dir = getUserAssetsDir('testuser');
    expect(dir).toContain('testuser');
    expect(dir).toContain('assets');
  });
});