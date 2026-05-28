interface StatusBarProps {
  currentPath: string | null;
  wordCount: number;
  llmConnected: boolean | null;
  error: string | null;
  aiOffline?: boolean;
}

export function StatusBar({ currentPath, wordCount, llmConnected, error, aiOffline }: StatusBarProps) {
  const isOnline = llmConnected === true;

  return (
    <div className="flex items-center justify-between px-3 py-0.5 text-[11px] border-t border-border bg-secondary/80 h-6">
      <div className="flex items-center gap-3">
        {currentPath && (
          <span className="text-muted-foreground truncate max-w-[300px]">{currentPath}</span>
        )}
        <span className="text-muted-foreground">{wordCount} words</span>
      </div>

      <div className="flex items-center gap-3">
        {error && (
          <span className="text-destructive truncate max-w-[300px]">{error}</span>
        )}
        <span className={`flex items-center gap-1 ${isOnline ? 'text-green-400' : aiOffline ? 'text-red-400' : 'text-muted-foreground'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : aiOffline ? 'bg-red-400' : 'bg-muted-foreground'}`} />
          {isOnline ? 'LLM Connected' : aiOffline ? 'LLM Offline' : 'Checking LLM...'}
        </span>
      </div>
    </div>
  );
}
