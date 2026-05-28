import { useState } from 'react';
import { RefreshCw, UserX, Image, AlertTriangle, TestTube2 } from 'lucide-react';
import SeverityBadge from '../components/SeverityBadge';
import ScanProgressBar from '../components/ScanProgressBar';

interface ReviewTabProps {
  reviewData: any;
  loading: boolean;
  error: string | null;
  loadReviewAction: () => Promise<void>;
  accountActionAction?: (
    username: string,
    action: 'add' | 'delete' | 'deactivate' | 'activate' | 'purge'
  ) => Promise<void>;
  isAdmin?: boolean;
}

export default function ReviewTab({
  reviewData,
  loading,
  error,
  loadReviewAction,
  accountActionAction,
  isAdmin = false,
}: ReviewTabProps) {
  const [confirmItem, setConfirmItem] = useState<{
    type: string;
    name: string;
    usernames?: string[];
  } | null>(null);
  const [removing, setRemoving] = useState(false);

  // Handle confirmed removal
  const handleConfirm = async () => {
    if (!confirmItem || !accountActionAction) return;
    setRemoving(true);
    try {
      if (confirmItem.type === 'all test accounts' && confirmItem.usernames) {
        // Delete all test accounts sequentially
        for (const username of confirmItem.usernames) {
          await accountActionAction(username, 'delete');
        }
      } else if (confirmItem.name) {
        // Single account removal
        await accountActionAction(confirmItem.name, 'delete');
      }
      // Refresh review data after deletion
      await loadReviewAction();
    } finally {
      setRemoving(false);
      setConfirmItem(null);
    }
  };

  // maintenance.js --review --json outputs: { summary: {...}, findings: [...] }
  // Each finding has { type: 'staleAccount' | 'duplicateImage', severity, user, path, detail, ... }
  // The route wraps as: { success: true, data: { summary, findings, ... } }
  const data = reviewData?.data || {};
  const findings = data.findings || [];
  const staleAccounts = findings.filter((f: any) => f.type === 'staleAccount');
  const testAccounts = findings.filter((f: any) => f.type === 'testAccount');
  const duplicateImages = findings.filter((f: any) => f.type === 'duplicateImage');

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={loadReviewAction}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Review
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Confirmation */}
      {confirmItem && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-sm flex items-center justify-between">
          <span>Remove {confirmItem.type}: "{confirmItem.name}"?</span>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={removing}
              className="px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs disabled:opacity-50"
            >
              {removing ? '...' : 'Confirm'}
            </button>
            <button onClick={() => setConfirmItem(null)} disabled={removing} className="px-2 py-1 bg-surface text-text-muted border border-border rounded text-xs disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !reviewData && <ScanProgressBar />}

      {/* Stale Accounts Section */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <UserX className="w-4 h-4 text-amber-400" />
          Stale Accounts
        </h3>
        {staleAccounts.length === 0 ? (
          <div className="text-sm text-text-muted p-4 border border-border rounded">
            {reviewData ? 'No stale accounts found.' : 'No review data yet. Click "Refresh Review" to load.'}
          </div>
        ) : (
          <div className="space-y-1">
            {staleAccounts.map((acc: any, i: number) => (
              <div key={acc.user || i} className="flex items-center gap-3 p-3 border border-border rounded-lg group hover:bg-surface-hover">
                <SeverityBadge severity={acc.severity || 'warning'} />
                <UserX className="w-4 h-4 text-text-muted shrink-0" />
                <span className="font-mono text-sm flex-1">{acc.user || 'unknown'}</span>
                <span className="text-xs text-text-muted">Last active: {acc.lastActive ? new Date(acc.lastActive).toLocaleDateString() : 'never'}</span>
                <button
                  onClick={() => setConfirmItem({ type: 'stale account', name: acc.user })}
                  disabled={removing}
                  className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Accounts Section */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <TestTube2 className="w-4 h-4 text-cyan-400" />
          Test Accounts
          {testAccounts.length > 0 && (
            <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
              {testAccounts.length} test accounts
            </span>
          )}
        </h3>
        {testAccounts.length === 0 ? (
          <div className="text-sm text-text-muted p-4 border border-border rounded">
            {reviewData ? 'No test accounts found.' : 'No review data yet. Click "Refresh Review" to load.'}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmItem({
                  type: 'all test accounts',
                  name: `(${testAccounts.length})`,
                  usernames: testAccounts.map((a: any) => a.user).filter(Boolean),
                })}
                disabled={removing}
                className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-xs hover:bg-cyan-500/30 disabled:opacity-50"
              >
                Remove All Test Accounts
              </button>
              <span className="text-xs text-text-muted">({testAccounts.length} accounts)</span>
            </div>
            <div className="space-y-1">
              {testAccounts.map((acc: any, i: number) => (
                <div key={acc.user || i} className="flex items-center gap-3 p-3 border border-border rounded-lg group hover:bg-surface-hover">
                  <SeverityBadge severity={acc.severity || 'info'} />
                  <TestTube2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-mono text-sm flex-1">{acc.user || 'unknown'}</span>
                  <span className="text-xs text-text-muted">{acc.sizeFiles ?? 0} files, {acc.detail || ''}</span>
                <button
                  onClick={() => setConfirmItem({ type: 'test account', name: acc.user })}
                  disabled={removing}
                  className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  Remove
                </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Duplicate Images Section */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Image className="w-4 h-4 text-blue-400" />
          Duplicate Images
        </h3>
        {duplicateImages.length === 0 ? (
          <div className="text-sm text-text-muted p-4 border border-border rounded">
            {reviewData ? 'No duplicate images found.' : 'No review data yet. Click "Refresh Review" to load.'}
          </div>
        ) : (
          <div className="space-y-1">
            {duplicateImages.map((group: any, i: number) => (
              <div key={i} className="p-3 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm">Duplicate group ({Array.isArray(group) ? group.length : group.files?.length || 0} files)</span>
                </div>
                {(Array.isArray(group) ? group : group.files || []).map((file: any, j: number) => (
                  <div key={file.path || j} className="flex items-center gap-2 ml-6 py-1 group hover:bg-surface-hover rounded">
                    <span className="text-xs font-mono text-text-muted flex-1 truncate">{file.path || String(file)}</span>
                  <button
                    onClick={() => setConfirmItem({ type: 'duplicate', name: file.path || String(file) })}
                    disabled={removing}
                    className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    Remove
                  </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty State */}
      {!loading && !reviewData && !error && (
        <div className="text-center py-12 text-text-muted">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg mb-1">No review data yet</p>
          <p className="text-sm">Click "Refresh Review" to load stale accounts, test accounts, and duplicates</p>
        </div>
      )}
    </div>
  );
}