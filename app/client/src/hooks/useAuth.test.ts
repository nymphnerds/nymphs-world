import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../services/api', async () => {
  return {
    login: vi.fn(),
    getMe: vi.fn(),
  };
});

import * as api from '../services/api';
const mockLogin = api.login as ReturnType<typeof vi.fn>;
const mockGetMe = api.getMe as ReturnType<typeof vi.fn>;
import useAuth from './useAuth';

function resetMocks() {
  mockLogin.mockReset();
  mockGetMe.mockReset();
  // Default: getMe always returns a valid user so useEffect doesn't crash
  mockGetMe.mockResolvedValue({ user: { username: 'default' } });
}

beforeEach(() => {
  resetMocks();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('useAuth', () => {
  it('should start unauthenticated with null user', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isNewUser).toBe(false);
  });

  it('should load token and user from localStorage on init', () => {
    localStorage.setItem('wbu_token', 'test-token');
    localStorage.setItem('wbu_user', JSON.stringify({ username: 'testuser' }));

    const { result } = renderHook(() => useAuth());

    expect(result.current.token).toBe('test-token');
    expect(result.current.user).toEqual({ username: 'testuser' });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should login and set token+user in localStorage', async () => {
    const loginUser = { username: 'newuser', isNewUser: true };
    mockLogin.mockResolvedValue({
      token: 'new-token',
      user: loginUser,
    });
    // After login sets token, useEffect calls getMe which overwrites user
    mockGetMe.mockResolvedValue({ user: loginUser });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('newuser');
    });

    expect(result.current.user).toEqual(loginUser);
    expect(result.current.token).toBe('new-token');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isNewUser).toBe(true);
    expect(localStorage.getItem('wbu_token')).toBe('new-token');
    expect(localStorage.getItem('wbu_user')).toBe(JSON.stringify({ username: 'newuser', isNewUser: true }));
  });

  it('should throw error when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.login('baduser')).rejects.toThrow('Invalid credentials');
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should throw network error when login throws non-Error', async () => {
    mockLogin.mockRejectedValue('string error');

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.login('baduser')).rejects.toThrow('Network error during login');
    });
  });

  it('should logout and clear localStorage', () => {
    localStorage.setItem('wbu_token', 'old-token');
    localStorage.setItem('wbu_user', JSON.stringify({ username: 'olduser' }));
    localStorage.setItem('wbu-ai-sidebar', 'open');
    localStorage.setItem('wbu-session', 'sess-123');
    localStorage.setItem('wbu_profile', 'game');
    localStorage.setItem('wbu_graph_cache_v6', 'cache-data');
    localStorage.setItem('wbu_graph_cache_v7', 'cache-data-v7');

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('wbu_token')).toBeNull();
    expect(localStorage.getItem('wbu_user')).toBeNull();
    expect(localStorage.getItem('wbu-ai-sidebar')).toBeNull();
    expect(localStorage.getItem('wbu-session')).toBeNull();
    expect(localStorage.getItem('wbu_profile')).toBeNull();
    expect(localStorage.getItem('wbu_graph_cache_v6')).toBeNull();
    expect(localStorage.getItem('wbu_graph_cache_v7')).toBeNull();
  });

  it('should call getMe on mount when token exists', async () => {
    localStorage.setItem('wbu_token', 'existing-token');
    mockGetMe.mockResolvedValue({ user: { username: 'existing' } });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toEqual({ username: 'existing' });
    });
  });

  it('should not call getMe on mount when no token', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => new Promise(r => setTimeout(r, 50)));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should auto-logout when getMe fails (expired token)', async () => {
    localStorage.setItem('wbu_token', 'expired-token');
    localStorage.setItem('wbu_user', JSON.stringify({ username: 'stale' }));
    mockGetMe.mockRejectedValue(new Error('Token expired'));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('wbu_token')).toBeNull();
  });

  it('should handle isNewUser=false for returning users', async () => {
    mockLogin.mockResolvedValue({
      token: 'ret-token',
      user: { username: 'returning', isNewUser: false },
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('returning');
    });

    expect(result.current.isNewUser).toBe(false);
  });
});