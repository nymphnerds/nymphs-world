import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SeverityBadge from './SeverityBadge';

interface FindingRowProps {
  finding: {
    severity: 'error' | 'warning' | 'info';
    path: string;
    description: string;
    details?: string;
    category: string;
  };
  onFix?: () => void;
}

export default function FindingRow({ finding, onFix }: FindingRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg mb-1 group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-hover rounded-lg"
      >
        <SeverityBadge severity={finding.severity} />
        <span className="text-xs text-text-muted shrink-0">{finding.category}</span>
        <span className="text-sm font-mono truncate flex-1">{finding.path}</span>
        <span className="text-sm text-text-muted truncate flex-1">{finding.description}</span>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border text-sm text-text-muted space-y-2">
          {finding.details && <p>{finding.details}</p>}
          {onFix && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFix();
              }}
              className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs hover:bg-red-500/30 transition-colors"
            >
              Fix
            </button>
          )}
        </div>
      )}
    </div>
  );
}