import { useState, useCallback } from 'react';
import {
  runHealthScan,
  fixHealth,
  loadReview,
  loadAccounts,
  showAccount,
  accountAction,
  bulkDeleteAccounts,
  selfServiceScan,
  selfServiceFix,
  selfServiceReview,
  checkAdminPasswordStatus,
  setAdminPassword,
  verifyAdminPassword,
  type MaintenanceResponse,
  type PasswordVerifyResponse,
} from '../services/api';

export interface UseMaintenanceReturn {
  // Mode
  adminMode: boolean;
  switchToAdmin: () => void;
  switchToSelf: () => void;

  // Password flow
  passwordSet: boolean | null; // null = not yet checked
  passwordAuthenticated: boolean;
  checkingPassword: boolean;
  passwordError: string | null;
  checkPasswordStatus: () => Promise<void>;
  submitPassword: (password: string) => Promise<boolean>;
  setPassword: (password: string) => Promise<void>;
  clearPasswordError: () => void;

  // Health scan state
  healthData: MaintenanceResponse | null;
  loading: boolean;
  error: string | null;

  // Account state
  accountData: MaintenanceResponse | null;
  accountsList: MaintenanceResponse | null;

  // Review state
  reviewData: MaintenanceResponse | null;

  // Actions
  runHealthScanAction: (username?: string) => Promise<void>;
  fixHealthAction: (username?: string) => Promise<void>;
  loadAccountsAction: () => Promise<void>;
  showAccountAction: (username: string) => Promise<void>;
  accountActionAction: (
    username: string,
    action: 'add' | 'delete' | 'deactivate' | 'activate' | 'purge'
  ) => Promise<void>;
  bulkDeleteAction: (pattern: string) => Promise<void>;
  loadReviewAction: (username?: string) => Promise<void>;
  clearError: () => void;
}

export function useMaintenance(): UseMaintenanceReturn {
  // Mode
  const [adminMode, setAdminMode] = useState(false);

  // Password flow
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const [passwordAuthenticated, setPasswordAuthenticated] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Health scan state
  const [healthData, setHealthData] = useState<MaintenanceResponse | null>(null);
  const [accountsList, setAccountsList] = useState<MaintenanceResponse | null>(null);
  const [accountData, setAccountData] = useState<MaintenanceResponse | null>(null);
  const [reviewData, setReviewData] = useState<MaintenanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const clearPasswordError = useCallback(() => setPasswordError(null), []);

  // ── Mode Switching ─────────────────────────────────────────────────────

  const switchToAdmin = useCallback(() => {
    setAdminMode(true);
  }, []);

  const switchToSelf = useCallback(() => {
    setAdminMode(false);
  }, []);

  // ── Password Flow ──────────────────────────────────────────────────────

  const checkPasswordStatus = useCallback(async () => {
    setCheckingPassword(true);
    try {
      const res = await checkAdminPasswordStatus();
      if (res.success) {
        setPasswordSet(res.passwordSet);
        if (!res.passwordSet) {
          // No password set yet, any authenticated user can become admin by setting one
          setPasswordAuthenticated(true);
          setAdminMode(true);
        }
      }
    } catch (err: any) {
      setPasswordSet(false);
    } finally {
      setCheckingPassword(false);
    }
  }, []);

  const submitPassword = useCallback(async (password: string): Promise<boolean> => {
    setPasswordError(null);
    setLoading(true);
    try {
      const res: PasswordVerifyResponse = await verifyAdminPassword(password);
      if (!res.success) {
        setPasswordError(res.error || 'Password verification failed');
        return false;
      }
      if (res.valid) {
        setPasswordAuthenticated(true);
        setAdminMode(true);
        return true;
      } else {
        setPasswordError('Incorrect password');
        return false;
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Password verification failed');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const setPassword = useCallback(async (password: string) => {
    setLoading(true);
    try {
      const res = await setAdminPassword(password);
      if (!res.success) {
        setPasswordError(res.error || 'Failed to set password');
      } else {
        setPasswordSet(true);
        setPasswordAuthenticated(true);
        setAdminMode(true);
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Health Scan Actions ────────────────────────────────────────────────

  const runHealthScanAction = useCallback(async (username?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = adminMode ? await runHealthScan(username) : await selfServiceScan();
      if (res.success) setHealthData(res);
      else setError(res.error || 'Health scan failed');
    } catch (err: any) {
      setError(err.message || 'Health scan failed');
    } finally {
      setLoading(false);
    }
  }, [adminMode]);

  const fixHealthAction = useCallback(async (username?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = adminMode ? await fixHealth(username) : await selfServiceFix();
      if (res.success) setHealthData(res);
      else setError(res.error || 'Fix failed');
    } catch (err: any) {
      setError(err.message || 'Fix failed');
    } finally {
      setLoading(false);
    }
  }, [adminMode]);

  // ── Review Actions ─────────────────────────────────────────────────────

  const loadReviewAction = useCallback(async (username?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = adminMode ? await loadReview() : await selfServiceReview();
      if (res.success) setReviewData(res);
      else setError(res.error || 'Failed to load review data');
    } catch (err: any) {
      setError(err.message || 'Failed to load review data');
    } finally {
      setLoading(false);
    }
  }, [adminMode]);

  // ── Account Actions (admin only) ───────────────────────────────────────

  const loadAccountsAction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadAccounts();
      if (res.success) setAccountsList(res);
      else setError(res.error || 'Failed to load accounts');
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  const showAccountAction = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await showAccount(username);
      if (res.success) setAccountData(res);
      else setError(res.error || 'Failed to load account details');
    } catch (err: any) {
      setError(err.message || 'Failed to load account details');
    } finally {
      setLoading(false);
    }
  }, []);

  const accountActionAction = useCallback(
    async (
      username: string,
      action: 'add' | 'delete' | 'deactivate' | 'activate' | 'purge'
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await accountAction(username, action);
        if (res.success) {
          setAccountData(res);
          const listRes = await loadAccounts();
          if (listRes.success) setAccountsList(listRes);
        } else {
          setError(res.error || `Account action "${action}" failed`);
        }
      } catch (err: any) {
        setError(err.message || `Account action "${action}" failed`);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const bulkDeleteAction = useCallback(async (pattern: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await bulkDeleteAccounts(pattern);
      if (res.success) {
        const listRes = await loadAccounts();
        if (listRes.success) setAccountsList(listRes);
      } else {
        setError(res.error || 'Bulk delete failed');
      }
    } catch (err: any) {
      setError(err.message || 'Bulk delete failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // Mode
    adminMode,
    switchToAdmin,
    switchToSelf,
    // Password
    passwordSet,
    passwordAuthenticated,
    checkingPassword,
    passwordError,
    checkPasswordStatus,
    submitPassword,
    setPassword,
    clearPasswordError,
    // Health
    healthData,
    loading,
    error,
    accountData,
    accountsList,
    reviewData,
    // Actions
    runHealthScanAction,
    fixHealthAction,
    loadAccountsAction,
    showAccountAction,
    accountActionAction,
    bulkDeleteAction,
    loadReviewAction,
    clearError,
  };
}