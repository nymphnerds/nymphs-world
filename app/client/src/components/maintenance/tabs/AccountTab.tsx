import { useState } from 'react';
import { Users, Plus, Trash2, Eye, UserX, UserCheck, HardDrive } from 'lucide-react';

interface AccountTabProps {
  accountsList: any;
  accountData: any;
  loading: boolean;
  error: string | null;
  loadAccountsAction: () => Promise<void>;
  showAccountAction: (username: string) => Promise<void>;
  accountActionAction: (
    username: string,
    action: 'add' | 'delete' | 'deactivate' | 'activate' | 'purge'
  ) => Promise<void>;
  bulkDeleteAction: (pattern: string) => Promise<void>;
}

export default function AccountTab({
  accountsList,
  accountData,
  loading,
  error,
  loadAccountsAction,
  showAccountAction,
  accountActionAction,
  bulkDeleteAction,
}: AccountTabProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [bulkPattern, setBulkPattern] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ user: string; action: string } | null>(null);

  // account.js --list --format json outputs { version, total, users: [...] }
  // The route wraps it as { success: true, data: { version, total, users: [...] } }
  const accounts = accountsList?.data?.users || accountsList?.data || [];
  // accountData comes from separate showAccount API call
  const accountDetail = accountData?.data;

  const handleAddUser = () => {
    if (newUsername.trim()) {
      accountActionAction(newUsername.trim(), 'add');
      setNewUsername('');
    }
  };

  const handleBulkDelete = () => {
    if (bulkPattern.trim()) {
      bulkDeleteAction(bulkPattern.trim());
      setBulkPattern('');
    }
  };

  const executeAction = () => {
    if (confirmAction) {
      accountActionAction(confirmAction.user, confirmAction.action as any);
      setConfirmAction(null);
      setSelectedUser(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={loadAccountsAction}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
        >
          <Users className="w-4 h-4" />
          Refresh
        </button>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Add user..."
            className="px-2 py-1 bg-surface border border-border rounded text-sm w-40 focus:border-primary focus:outline-none"
          />
          <button
            onClick={handleAddUser}
            disabled={loading || !newUsername.trim()}
            className="flex items-center gap-1 px-2 py-1 bg-surface text-text-muted border border-border rounded text-xs hover:bg-surface-hover disabled:opacity-50"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="text"
            value={bulkPattern}
            onChange={(e) => setBulkPattern(e.target.value)}
            placeholder="Bulk delete pattern..."
            className="px-2 py-1 bg-surface border border-border rounded text-sm w-48 focus:border-primary focus:outline-none"
          />
          <button
            onClick={handleBulkDelete}
            disabled={loading || !bulkPattern.trim()}
            className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs hover:bg-red-500/30 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-sm flex items-center justify-between">
          <span>Confirm: {confirmAction.action} user "{confirmAction.user}"?</span>
          <div className="flex gap-2">
            <button onClick={executeAction} className="px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs">
              Confirm
            </button>
            <button onClick={() => setConfirmAction(null)} className="px-2 py-1 bg-surface text-text-muted border border-border rounded text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Account Detail View */}
      {selectedUser && accountDetail && (
        <div className="p-4 bg-surface border border-border rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selectedUser}</h3>
            <button onClick={() => setSelectedUser(null)} className="text-xs text-text-muted hover:text-foreground">
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-text-muted">Status:</span> {accountDetail.status || 'unknown'}</div>
            <div><span className="text-text-muted">Created:</span> {accountDetail.created ? new Date(accountDetail.created).toLocaleString() : 'N/A'}</div>
            <div><span className="text-text-muted">Last Login:</span> {accountDetail.lastLogin ? new Date(accountDetail.lastLogin).toLocaleString() : 'Never'}</div>
            <div><span className="text-text-muted">Workspace Size:</span> {accountDetail.size || 'N/A'}</div>
          </div>
          <div className="flex gap-2 pt-2">
            {accountDetail.status === 'active' ? (
              <button onClick={() => setConfirmAction({ user: selectedUser, action: 'deactivate' })} className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs">
                <UserX className="w-3 h-3" /> Deactivate
              </button>
            ) : (
              <button onClick={() => setConfirmAction({ user: selectedUser, action: 'activate' })} className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs">
                <UserCheck className="w-3 h-3" /> Activate
              </button>
            )}
            <button onClick={() => setConfirmAction({ user: selectedUser, action: 'purge' })} className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs">
              <HardDrive className="w-3 h-3" /> Purge
            </button>
          </div>
        </div>
      )}

      {/* Account List */}
      {loading && !accountsList ? (
        <div className="text-center py-8 text-text-muted">Loading accounts...</div>
      ) : Array.isArray(accounts) && accounts.length > 0 ? (
        <div className="space-y-1">
          {accounts.map((acc: any) => (
            <div key={acc.username} className="flex items-center gap-3 p-3 border border-border rounded-lg group hover:bg-surface-hover">
              <span className="font-mono text-sm flex-1">{acc.username}</span>
              <span className="text-xs text-text-muted">{acc.createdAt ? new Date(acc.createdAt).toLocaleDateString() : '-'}</span>
              <span className="text-xs text-text-muted">{acc.status || 'active'}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { showAccountAction(acc.username); setSelectedUser(acc.username); }} className="p-1 hover:bg-surface-hover rounded" title="View">
                  <Eye className="w-3 h-3 text-text-muted" />
                </button>
                <button onClick={() => setConfirmAction({ user: acc.username, action: 'deactivate' })} className="p-1 hover:bg-surface-hover rounded" title="Deactivate">
                  <UserX className="w-3 h-3 text-amber-400" />
                </button>
                <button onClick={() => setConfirmAction({ user: acc.username, action: 'delete' })} className="p-1 hover:bg-surface-hover rounded" title="Delete">
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-text-muted">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg mb-1">No accounts found</p>
          <p className="text-sm">Click "Refresh" to load account list</p>
        </div>
      )}
    </div>
  );
}