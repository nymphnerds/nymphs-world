import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import useAuth from '../../hooks/useAuth';
import Login from '../../pages/Login';

interface AuthContextValue {
  user: { username: string; isNewUser?: boolean } | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
  login: (username: string) => Promise<{ username: string; isNewUser?: boolean } | null>;
  logout: () => void;
  clearNewUserFlag: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, login, logout, isNewUser: isNewFromAuth } = useAuth();
  const [showNewUserFlag, setShowNewUserFlag] = useState(isNewFromAuth && !localStorage.getItem('wbu_profile'));

  // Sync from auth hook (changes on login)
  useEffect(() => {
    setShowNewUserFlag(isNewFromAuth && !localStorage.getItem('wbu_profile'));
  }, [isNewFromAuth]);

  const clearNewUserFlag = useCallback(() => {
    setShowNewUserFlag(false);
  }, []);

  if (!isAuthenticated) {
    return <Login onLogin={login} />;
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isNewUser: showNewUserFlag, login, logout, clearNewUserFlag }}>
      {children}
    </AuthContext.Provider>
  );
}
