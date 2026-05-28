import { useState, useEffect, useCallback } from 'react';
import { login as apiLogin, getMe } from '../services/api';

interface User {
  username: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isNewUser: boolean;
}

const TOKEN_KEY = 'wbu_token';
const USER_KEY = 'wbu_user';

export default function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    return {
      token,
      user: user ? JSON.parse(user) : null,
      isAuthenticated: !!token,
      isLoading: false,
      isNewUser: user ? (JSON.parse(user).isNewUser || false) : false,
    };
  });

  // Login with username
  const login = useCallback(async (username: string) => {
    try {
      const { token, user } = await apiLogin(username);

      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        isNewUser: user?.isNewUser || false,
      });

      return user;
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(err.message || 'Login failed');
      }
      throw new Error('Network error during login');
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('wbu-ai-sidebar');
    localStorage.removeItem('wbu-session');
    localStorage.removeItem('wbu_profile');
    // Clear old shared graph cache keys (prevents stale cross-user data from legacy format)
    // Do NOT clear username-scoped keys — they are the user's own data and should persist across logout/login
    localStorage.removeItem('wbu_graph_cache_v6');
    localStorage.removeItem('wbu_graph_cache_v7');

    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isNewUser: false,
    });
  }, []);

  // Check auth status on mount
  useEffect(() => {
    if (state.token) {
      getMe()
        .then((res: { user: User }) => {
          setState((prev) => ({
            ...prev,
            user: res.user,
            isLoading: false,
          }));
        })
        .catch(() => {
          // Token expired or invalid
          logout();
        });
    }
  }, [state.token, logout]);

  return {
    ...state,
    login,
    logout,
  };
}