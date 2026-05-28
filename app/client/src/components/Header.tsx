import { FilePlus, LogOut, User, FileInput, Sparkles, ChevronDown, HelpCircle, Gamepad2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  onNewFile: () => void;
  onCreateFromTemplate: () => void;
  onImportDOCX: () => void;
  onLogout: () => void;
  username: string;
  showAISidebar: boolean;
  onToggleAISidebar?: () => void;
  aiOffline?: boolean;
  onOpenHelp?: () => void;
  onGenerateGameFile?: () => void;
}

export function Header({ onNewFile, onCreateFromTemplate, onImportDOCX, onLogout, username, showAISidebar, onToggleAISidebar, aiOffline, onOpenHelp, onGenerateGameFile }: HeaderProps) {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!fileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [fileMenuOpen]);

  return (
    <header className="flex items-center justify-between px-5 py-2.5 bg-secondary border-b border-border h-12">
       <div className="flex items-center gap-5">
        <div className="flex items-baseline">
          <h1 className="text-xl font-semibold tracking-wider text-white" style={{ fontFamily: "'Orbitron', sans-serif" }}>WORBI</h1>
          <span className="text-[10px] text-gray-400 font-normal ml-0.5 leading-none">by Nymphs</span>
          <span className="text-sm text-muted-foreground ml-4">WorldBuilder UI</span>
        </div>
       </div>

      <div className="flex items-center gap-1">
        {/* File menu with dropdown */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded hover:bg-accent transition-colors text-gray-300 hover:text-white"
            title="New File"
          >
            <FilePlus size={14} />
            <span>File</span>
            <ChevronDown size={10} />
          </button>
          {fileMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-[#1e1e2e] border border-border rounded-lg shadow-xl py-1">
              <button
                onClick={() => { setFileMenuOpen(false); onNewFile(); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-accent hover:text-white transition-colors"
              >
                New Blank File
              </button>
              <button
                onClick={() => { setFileMenuOpen(false); onCreateFromTemplate(); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-accent hover:text-white transition-colors"
              >
                New from Template...
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { setFileMenuOpen(false); onImportDOCX(); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-accent hover:text-white transition-colors flex items-center gap-2"
              >
                <FileInput size={12} />
                Import DOCX
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Generate Game File Button */}
        {onGenerateGameFile && (
          <button
            onClick={onGenerateGameFile}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded hover:bg-accent transition-colors text-gray-300 hover:text-white"
            title="Generate Game File from current document"
          >
            <Gamepad2 size={14} />
            <span>Game Export</span>
          </button>
        )}

        <div className="w-px h-4 bg-border mx-1" />

        {/* Help Button */}
        <button
          onClick={() => onOpenHelp?.()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded hover:bg-accent transition-colors text-gray-300 hover:text-white"
          title="Help (F1)"
        >
          <HelpCircle size={14} />
          <span>Help</span>
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* AI Sidebar Toggle */}
        <button
          onClick={onToggleAISidebar}
          disabled={aiOffline}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            aiOffline
              ? 'opacity-30 cursor-not-allowed text-gray-500'
              : showAISidebar
                ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60'
                : 'hover:bg-accent text-gray-300 hover:text-white'
          }`}
          title={aiOffline ? "AI server is offline" : showAISidebar ? "Hide AI Sidebar" : "Show AI Sidebar"}
        >
          <Sparkles size={14} />
          <span>AI</span>
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* User display */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground" title={username}>
          <User size={14} />
          <span>{username}</span>
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded hover:bg-red-900/30 text-muted-foreground hover:text-red-300 transition-colors"
          title="Logout"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}