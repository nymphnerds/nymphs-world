import { FileText, Star, Plus, Clock, X, Sparkles, LayoutTemplate, HelpCircle } from 'lucide-react';

interface WelcomeFile {
  path: string;
  name: string;
}

interface WelcomeProps {
  recentFiles: (WelcomeFile & { lastOpened: number })[];
  starredFiles: WelcomeFile[];
  onFileClick: (path: string) => void;
  onRemoveRecent: (path: string) => void;
  onToggleStar: (path: string) => void;
  onNewFile: () => void;
  onCreateFromTemplate?: () => void;
  onGenerateWithAI?: () => void;
  aiOffline?: boolean;
  onOpenHelp?: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

export function Welcome({
  recentFiles,
  starredFiles,
  onFileClick,
  onRemoveRecent,
  onToggleStar,
  onNewFile,
  onCreateFromTemplate,
  onGenerateWithAI,
  aiOffline,
  onOpenHelp,
}: WelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[hsl(225,15%,10%)] text-gray-200 overflow-y-auto">
      <div className="max-w-lg w-full px-6 py-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <Sparkles size={32} className="text-purple-400 mb-2" />
          <h1 className="text-5xl font-bold text-white tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>WORBI</h1>
          <span className="text-sm text-gray-500 font-medium mt-1">by Nymphs</span>
          <p className="text-gray-400 text-sm mt-2">WorldBuilder UI — Your creative workspace</p>
        </div>

          {/* Quick Actions */}
          <div className="mb-8 space-y-2">
            {onOpenHelp && (
              <button
                onClick={onOpenHelp}
                className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-lg bg-[#2a2a3a] hover:bg-[#3a3a4a] text-gray-400 hover:text-white border border-[#3a3a4a] transition-colors text-sm"
              >
                <HelpCircle size={16} />
                <span>Get Help (F1)</span>
              </button>
            )}
          <button
            onClick={onNewFile}
            className="flex items-center gap-2 w-full justify-center px-4 py-3 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-colors font-medium"
          >
            <Plus size={18} />
            <span>New File</span>
          </button>
          {onCreateFromTemplate && (
            <button
              onClick={onCreateFromTemplate}
              className="flex items-center gap-2 w-full justify-center px-4 py-3 rounded-lg bg-purple-900/20 hover:bg-purple-900/40 text-purple-300 border border-purple-500/30 transition-colors font-medium"
            >
              <LayoutTemplate size={18} />
              <span>New from Template</span>
            </button>
          )}
          {onGenerateWithAI && (
            <button
              onClick={onGenerateWithAI}
              disabled={aiOffline}
              className={`flex items-center gap-2 w-full justify-center px-4 py-3 rounded-lg transition-colors font-medium ${
                aiOffline
                  ? 'opacity-30 cursor-not-allowed bg-indigo-900/10 text-gray-500 border border-indigo-500/10'
                  : 'bg-indigo-900/20 hover:bg-indigo-900/40 text-indigo-300 border border-indigo-500/30'
              }`}
              title={aiOffline ? "AI server is offline" : undefined}
            >
              <Sparkles size={18} />
              <span>Generate with AI</span>
            </button>
          )}
        </div>

        {/* Starred Files */}
        {starredFiles.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Favorites</h2>
            </div>
            <div className="space-y-1">
              {starredFiles.map(file => (
                <div
                  key={file.path}
                  className="group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => onFileClick(file.path)}
                >
                  <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate text-sm text-gray-200">{file.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleStar(file.path); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-gray-400 hover:text-red-400 transition-all"
                    title="Remove from favorites"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Files */}
        {recentFiles.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-gray-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recent Files</h2>
            </div>
            <div className="space-y-1">
              {recentFiles.map(file => (
                <div
                  key={file.path}
                  className="group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => onFileClick(file.path)}
                >
                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate text-sm text-gray-200">{file.name}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">{formatTimeAgo(file.lastOpened)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveRecent(file.path); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-gray-400 hover:text-red-400 transition-all"
                    title="Remove from recent"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {recentFiles.length === 0 && starredFiles.length === 0 && (
          <div className="text-center py-10">
            <FileText size={40} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">No recent files</p>
            <p className="text-gray-600 text-xs mt-1">Create or open a file to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}