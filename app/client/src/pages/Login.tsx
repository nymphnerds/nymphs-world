import { useState } from 'react';
import { checkUser } from '../services/api';

interface LoginProps {
  onLogin: (username: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.trim().length < 2 || username.trim().length > 30) {
      setError('Username must be 2-30 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      setError('Username can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    // Check if user exists before proceeding
    try {
      const { exists } = await checkUser(username.trim());
      if (!exists) {
        // User doesn't exist — show confirmation dialog
        setConfirmUsername(username.trim());
        setShowCreateConfirm(true);
        return;
      }
    } catch (err) {
      // If check fails, fall through to normal login
      console.warn('Failed to check user existence:', err);
    }

    // User exists, proceed with login
    setLoading(true);
    try {
      await onLogin(username.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccount() {
    setShowCreateConfirm(false);
    setLoading(true);
    try {
      await onLogin(confirmUsername);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account creation failed');
    } finally {
      setLoading(false);
    }
  }

  function handleCancelCreate() {
    setShowCreateConfirm(false);
    setConfirmUsername('');
  }

  function handleCreateNewAccountClick() {
    if (!username.trim()) {
      setError('Enter a username first');
      return;
    }
    setConfirmUsername(username.trim());
    setShowCreateConfirm(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🌍</div>
          <div className="flex items-baseline justify-center gap-1 mb-1">
            <h1 className="text-4xl font-bold text-white" style={{ fontFamily: "'Orbitron', sans-serif" }}>WORBI</h1>
            <span className="text-sm text-gray-400 font-normal leading-none">by Nymphs</span>
          </div>
          <p className="text-purple-300">WorldBuilder UI</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-purple-500/30 p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">Sign In</h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                autoFocus
                autoComplete="username"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Enter Workspace'}
            </button>
          </form>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleCreateNewAccountClick}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gray-700/50 hover:bg-gray-700/80 text-gray-300 hover:text-white font-medium rounded-lg border border-gray-600/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Create New Account
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-gray-500">
            You'll be asked to confirm before creating a new account.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-500">
          WORBI v6.2.43 &mdash; WorldBuilder UI
        </p>
      </div>

      {/* Create Account Confirmation Overlay */}
      {showCreateConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl border border-purple-500/30 p-8 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-3 text-center">Create New Account?</h3>
            <p className="text-gray-300 text-sm text-center mb-6">
              No account found for <span className="font-bold text-white">'{confirmUsername}'</span>.
              Are you sure you want to create a new account, or did you make a typo?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelCreate}
                className="flex-1 py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAccount}
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}