import { useState } from 'react';
import { Search, Zap, User } from 'lucide-react';
import SummaryCards from '../components/SummaryCards';
import FindingRow from '../components/FindingRow';
import ScanProgressBar from '../components/ScanProgressBar';

interface HealthTabProps {
  healthData: any;
  loading: boolean;
  error: string | null;
  runHealthScanAction: (username?: string) => Promise<void>;
  fixHealthAction: (username?: string) => Promise<void>;
  isAdmin?: boolean;
}

type SeverityFilter = 'all' | 'error' | 'warning' | 'info';

export default function HealthTab({
  healthData,
  loading,
  error,
  runHealthScanAction,
  fixHealthAction,
  isAdmin = false,
}: HealthTabProps) {
  const [userInput, setUserInput] = useState('');
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [confirmFixAll, setConfirmFixAll] = useState(false);

  // Parse scan data
  // maintenance.js --json outputs: { summary: { totalFindings, byType: { orphanedImage: N, ... }, bySeverity: {...}, fixable, fixed }, findings: [...] }
  // The route wraps as: { success: true, data: { summary, findings, ... } }
  const data = healthData?.data;
  const findings = data?.findings || [];
  const summary = data?.summary || {};
  const byType = summary.byType || {};

  const filteredFindings = filter === 'all'
    ? findings
    : findings.filter((f: any) => f.severity === filter);

  // byType keys from detectors: orphanedImages, orphanedMetadata, emptyDirs, corruptedHtml, brokenLinks, duplicateImages
  const counts = {
    brokenLinks: byType.brokenLinks || byType.brokenLink || 0,
    orphanedImages: byType.orphanedImages || byType.orphanedImage || 0,
    orphanedMeta: byType.orphanedMetadata || byType.orphanedMeta || 0,
    emptyDirs: byType.emptyDirs || byType.emptyDir || 0,
    corruptedHtml: byType.corruptedHtml || byType.corruptedHTML || 0,
    duplicates: byType.duplicateImages || byType.duplicateImage || 0,
  };

  const handleScanUser = () => {
    if (userInput.trim()) {
      runHealthScanAction(userInput.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => runHealthScanAction()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          Run Scan
        </button>

        {confirmFixAll ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">Fix all issues?</span>
            <button
              onClick={() => {
                fixHealthAction();
                setConfirmFixAll(false);
              }}
              className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs hover:bg-red-500/30"
            >
              Yes, Fix All
            </button>
            <button
              onClick={() => setConfirmFixAll(false)}
              className="px-2 py-1 bg-surface text-text-muted border border-border rounded text-xs hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmFixAll(true)}
            disabled={loading || !healthData}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md text-sm hover:bg-amber-500/30 disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            Fix All
          </button>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <User className="w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Scan specific user..."
              className="px-2 py-1 bg-surface border border-border rounded text-sm w-48 focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleScanUser}
              disabled={loading || !userInput.trim()}
              className="px-2 py-1 bg-surface text-text-muted border border-border rounded text-xs hover:bg-surface-hover disabled:opacity-50"
            >
              Go
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && <ScanProgressBar />}

      {/* Results */}
      {!loading && data && (
        <>
          {/* Summary Cards */}
          <SummaryCards {...counts} />

          {/* Severity Filter */}
          <div className="flex gap-2">
            {(['all', 'error', 'warning', 'info'] as SeverityFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs border transition-colors ${
                  filter === f
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'bg-surface text-text-muted border-border hover:bg-surface-hover'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'all' && ` (${findings.length})`}
              </button>
            ))}
          </div>

          {/* Findings List */}
          {filteredFindings.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              {findings.length === 0 ? 'No issues found. Your workspace is healthy!' : 'No findings match this filter.'}
            </div>
          ) : (
            filteredFindings.map((finding: any, i: number) => (
              <FindingRow
                key={`${finding.path}-${i}`}
                finding={finding}
                onFix={() => fixHealthAction()}
              />
            ))
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !data && !error && (
        <div className="text-center py-12 text-text-muted">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg mb-1">No scan results yet</p>
          <p className="text-sm">Click "Run Scan" to check workspace health</p>
        </div>
      )}
    </div>
  );
}