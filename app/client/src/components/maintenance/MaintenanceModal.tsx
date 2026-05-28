import { useState } from 'react';
import { X, Shield, User, Lock } from 'lucide-react';
import { useMaintenance } from '../../hooks/useMaintenance';
import HealthTab from './tabs/HealthTab';
import AccountTab from './tabs/AccountTab';
import ReviewTab from './tabs/ReviewTab';

type TabKey = 'health' | 'accounts' | 'review';
type PasswordFlow = 'none' | 'set' | 'verify';

interface MaintenanceModalProps {
  show: boolean;
  onClose: () => void;
}

export default function MaintenanceModal({ show, onClose }: MaintenanceModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('health');
  const [passwordFlow, setPasswordFlow] = useState<PasswordFlow>('none');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const {
    // Mode
    adminMode, switchToAdmin, switchToSelf,
    // Password
    passwordSet, passwordAuthenticated, checkingPassword, passwordError,
    checkPasswordStatus, submitPassword, setPassword, clearPasswordError,
    // Data
    healthData, loading, error, accountsList, accountData, reviewData,
    // Actions
    runHealthScanAction, fixHealthAction,
    loadAccountsAction, showAccountAction, accountActionAction, bulkDeleteAction,
    loadReviewAction, clearError,
  } = useMaintenance();

  // Password dialog is only triggered by handleTryAdmin when user clicks Admin button
  // No automatic password checks on modal open - Self mode should work immediately

  const handlePasswordSubmit = async () => {
    if (passwordFlow === 'set') {
      if (passwordInput !== confirmPassword) {
        clearPasswordError();
        return; // Will be handled by UI error display
      }
      await setPassword(passwordInput);
      if (!passwordError) {
        setShowPasswordDialog(false);
        setPasswordFlow('none');
        setPasswordInput('');
        setConfirmPassword('');
      }
    } else {
      const ok = await submitPassword(passwordInput);
      if (ok && !passwordError) {
        setShowPasswordDialog(false);
        setPasswordFlow('none');
        setPasswordInput('');
      }
    }
  };

  const handleTryAdmin = async () => {
    if (passwordAuthenticated) {
      switchToAdmin();
      return;
    }
    // Always re-check status from server before showing dialog
    // to ensure passwordSet state is current
    await checkPasswordStatus();
    // Wait a tick for state to propagate, then show the correct dialog
    setTimeout(() => {
      if (passwordAuthenticated) {
        return;
      }
      if (passwordSet === false) {
        setPasswordFlow('set');
      } else {
        setPasswordFlow('verify');
      }
      setShowPasswordDialog(true);
    }, 50);
  };

  const handleSwitchToSelf = () => {
    switchToSelf();
    setActiveTab('health');
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-5xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Maintenance</h2>
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 text-xs bg-surface rounded-full p-0.5 border border-border">
              <button
                onClick={handleSwitchToSelf}
                className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
                  !adminMode
                    ? 'bg-primary/20 text-primary'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <User className="w-3 h-3" />
                Self
              </button>
              <button
                onClick={handleTryAdmin}
                className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
                  adminMode
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <Shield className="w-3 h-3" />
                Admin
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Mode Indicator Banner */}
        {adminMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 mt-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
            <Shield className="w-3.5 h-3.5" />
            <span>Admin mode — scanning all users, managing accounts</span>
            <button
              onClick={handleSwitchToSelf}
              className="ml-auto text-amber-300 hover:text-amber-200 underline"
            >
              Switch to self-service
            </button>
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex gap-1 mt-3">
          {([
            ['health', 'Health'],
            ...(adminMode ? ([['accounts', 'Accounts']] as [TabKey, string][]) : []),
            ['review', 'Review'],
          ] as [TabKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                activeTab === key
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : 'text-text-muted border-transparent hover:bg-surface-hover'
              }`}
            >
              {key === 'accounts' && adminMode && <span className="mr-1">🔒</span>}
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto max-h-[60vh] py-4">
          {activeTab === 'health' && (
            <HealthTab
              healthData={healthData}
              loading={loading}
              error={error}
              runHealthScanAction={runHealthScanAction}
              fixHealthAction={fixHealthAction}
              isAdmin={adminMode}
            />
          )}
          {activeTab === 'accounts' && adminMode && (
            <AccountTab
              accountsList={accountsList}
              accountData={accountData}
              loading={loading}
              error={error}
              loadAccountsAction={loadAccountsAction}
              showAccountAction={showAccountAction}
              accountActionAction={accountActionAction}
              bulkDeleteAction={bulkDeleteAction}
            />
          )}
          {activeTab === 'review' && (
            <ReviewTab
              reviewData={reviewData}
              loading={loading}
              error={error}
              loadReviewAction={loadReviewAction}
              accountActionAction={adminMode ? accountActionAction : undefined}
              isAdmin={adminMode}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-text-muted">
          <span>WORBI Maintenance Tool v1.0</span>
          {healthData?.timestamp && (
            <span>Last scan: {new Date(healthData.timestamp).toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Password Dialog */}
      {showPasswordDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => {
          if (!loading) {
            setShowPasswordDialog(false);
            setPasswordFlow('none');
            setPasswordInput('');
            setConfirmPassword('');
            clearPasswordError();
          }
        }}>
          <div
            className="bg-surface border border-border rounded-lg p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {passwordFlow === 'set' ? 'Set Admin Password' : 'Admin Password Required'}
              </h3>
            </div>

            <p className="text-sm text-text-muted mb-4">
              {passwordFlow === 'set'
                ? 'No admin password exists yet. As the first user, you can set the shared admin password for maintenance tools.'
                : 'Enter the admin password to access admin maintenance features.'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  {passwordFlow === 'set' ? 'Admin Password' : 'Password'}
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    clearPasswordError();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) handlePasswordSubmit();
                  }}
                  placeholder="Enter password..."
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded text-sm focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              {passwordFlow === 'set' && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      clearPasswordError();
                    }}
                    placeholder="Confirm password..."
                    className="w-full px-3 py-2 bg-surface-dark border border-border rounded text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {/* Error Display */}
              {passwordError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                  {passwordError}
                </div>
              )}
              {passwordFlow === 'set' && passwordInput && confirmPassword && passwordInput !== confirmPassword && !passwordError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                  Passwords do not match
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowPasswordDialog(false);
                    setPasswordFlow('none');
                    setPasswordInput('');
                    setConfirmPassword('');
                    clearPasswordError();
                  }}
                  disabled={loading}
                  className="flex-1 px-3 py-2 text-sm bg-surface-dark border border-border rounded hover:bg-surface-hover disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={loading || !passwordInput || (passwordFlow === 'set' && (!confirmPassword || passwordInput !== confirmPassword))}
                  className="flex-1 px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '...' : passwordFlow === 'set' ? 'Set Password' : 'Verify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}