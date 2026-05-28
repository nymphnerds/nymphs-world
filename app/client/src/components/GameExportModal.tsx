import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Gamepad2, Loader2, Check, AlertCircle, FileText, Download } from 'lucide-react';
import { getFileContent, listFiles, updateFile, type FileItem } from '../services/api';
import {
  buildExportCandidate,
  isPotentialGameSource,
  type GameExportCandidate,
  type GameExportIssue,
} from '../utils/gameExportConverter';
import { createZipBlob, type ZipInputFile } from '../utils/zipFiles';

interface GameExportModalProps {
  currentPath: string | null;
  content: string;
  onClose: () => void;
  onFileCreated: (path: string) => void;
  aiOffline?: boolean;
}

type ExportStatus = 'checking' | 'ready' | 'exporting' | 'done' | 'error';

interface ExportSummary {
  exported: GameExportCandidate[];
  skipped: GameExportIssue[];
}

export function GameExportModal({ onClose, onFileCreated }: GameExportModalProps) {
  const [status, setStatus] = useState<ExportStatus>('checking');
  const [currentMessage, setCurrentMessage] = useState('Checking GameReady...');
  const [summary, setSummary] = useState<ExportSummary>({ exported: [], skipped: [] });
  const [gameReadyFiles, setGameReadyFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const startedRef = useRef(false);

  const scanFolder = useCallback(async (folderPath = ''): Promise<FileItem[]> => {
    const items = await listFiles(folderPath);
    const files: FileItem[] = [];

    for (const item of items) {
      if (item.type === 'folder') {
        files.push(...await scanFolder(item.path));
      } else {
        files.push(item);
      }
    }

    return files;
  }, []);

  const listGameReadyFiles = useCallback(async (): Promise<FileItem[]> => {
    try {
      return (await scanFolder('GameReady')).filter(file => file.path.toLowerCase().endsWith('.txt'));
    } catch {
      return [];
    }
  }, [scanFolder]);

  const runExport = useCallback(async () => {
    setStatus('exporting');
    setCurrentMessage('Scanning workspace...');
    setError(null);
    setZipError(null);

    const exported: GameExportCandidate[] = [];
    const skipped: GameExportIssue[] = [];

    try {
      const files = (await scanFolder()).filter(file => isPotentialGameSource(file.path));

      for (const file of files) {
        setCurrentMessage(`Exporting ${file.path}`);
        const content = await getFileContent(file.path);
        const candidate = buildExportCandidate(file.path, content);

        if ('reason' in candidate) {
          skipped.push(candidate);
          continue;
        }

        await updateFile(candidate.outputPath, candidate.content);
        exported.push(candidate);
      }

      setSummary({ exported, skipped });
      setGameReadyFiles(await listGameReadyFiles());
      setStatus('done');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown export error');
      setSummary({ exported, skipped });
      setStatus('error');
    }
  }, [listGameReadyFiles, scanFolder]);

  const handleDownloadZip = useCallback(async () => {
    setIsZipping(true);
    setZipError(null);

    try {
      const files = await listGameReadyFiles();
      setGameReadyFiles(files);

      if (files.length === 0) {
        setZipError('No GameReady TXT files are available to zip yet.');
        return;
      }

      const zipFiles: ZipInputFile[] = [];
      for (const file of files) {
        setCurrentMessage(`Adding ${file.path} to zip`);
        zipFiles.push({
          path: file.path,
          content: await getFileContent(file.path),
        });
      }

      const blob = createZipBlob(zipFiles);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `worbi-gameready-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setZipError(`ZIP download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsZipping(false);
    }
  }, [listGameReadyFiles]);

  const handleClose = useCallback(() => {
    const lastExported = summary.exported[summary.exported.length - 1];
    if (lastExported) {
      onFileCreated(lastExported.outputPath);
      return;
    }

    const lastExisting = gameReadyFiles[gameReadyFiles.length - 1];
    if (lastExisting) {
      onFileCreated(lastExisting.path);
      return;
    }

    onClose();
  }, [gameReadyFiles, onClose, onFileCreated, summary.exported]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      setStatus('checking');
      setCurrentMessage('Checking existing GameReady export...');
      const existingFiles = await listGameReadyFiles();
      setGameReadyFiles(existingFiles);

      if (existingFiles.length > 0) {
        setStatus('ready');
        return;
      }

      await runExport();
    })();
  }, [listGameReadyFiles, runExport]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-[#1e1e2e] rounded-lg shadow-2xl border border-[#3a3a4a] w-[90vw] max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Gamepad2 size={16} className="text-green-400" />
            <h2 className="text-sm font-semibold text-white">Game Export</h2>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-4">
          {(status === 'checking' || status === 'exporting') && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="text-green-400 animate-spin" />
              <p className="text-sm text-muted-foreground">{currentMessage}</p>
              <p className="text-xs text-muted-foreground">
                {status === 'checking' ? 'Looking for an existing GameReady export' : 'Converting Build: Yes documents to GameReady TXT'}
              </p>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded bg-green-900/20 border border-green-800/50">
                <Check size={18} className="text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white">Existing GameReady export found</p>
                  <p className="text-xs text-muted-foreground">
                    {gameReadyFiles.length} TXT file{gameReadyFiles.length === 1 ? '' : 's'} available. Run export again only when you want to refresh them.
                  </p>
                </div>
              </div>

              <GameReadyFilesView files={gameReadyFiles} />
              {zipError && <p className="text-xs text-red-300">{zipError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isZipping ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Download ZIP
                </button>
                <button onClick={runExport} className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-accent">
                  Run Again
                </button>
                <button onClick={handleClose} className="px-3 py-1.5 text-xs rounded bg-green-700 text-white hover:bg-green-600">
                  Close
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded bg-red-900/20 border border-red-800/50">
                <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
              <ExportSummaryView summary={summary} />
              {gameReadyFiles.length > 0 && <GameReadyFilesView files={gameReadyFiles} />}
              {zipError && <p className="text-xs text-red-300">{zipError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleDownloadZip}
                  disabled={isZipping || gameReadyFiles.length === 0}
                  className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isZipping ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Download ZIP
                </button>
                <button onClick={runExport} className="px-3 py-1.5 text-xs rounded bg-green-700 text-white hover:bg-green-600">
                  Retry
                </button>
                <button onClick={handleClose} className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-accent">
                  Close
                </button>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded bg-green-900/20 border border-green-800/50">
                <Check size={18} className="text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white">Export complete</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.exported.length} file{summary.exported.length === 1 ? '' : 's'} written to GameReady/
                  </p>
                </div>
              </div>

              <ExportSummaryView summary={summary} />
              {gameReadyFiles.length > 0 && <GameReadyFilesView files={gameReadyFiles} />}
              {zipError && <p className="text-xs text-red-300">{zipError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleDownloadZip}
                  disabled={isZipping || gameReadyFiles.length === 0}
                  className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isZipping ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Download ZIP
                </button>
                <button onClick={runExport} className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-accent">
                  Run Again
                </button>
                <button onClick={handleClose} className="px-3 py-1.5 text-xs rounded bg-green-700 text-white hover:bg-green-600">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GameReadyFilesView({ files }: { files: FileItem[] }) {
  if (files.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">GameReady Files</p>
      <div className="max-h-48 overflow-auto rounded border border-border bg-background/50">
        {files.map((file) => (
          <div key={file.path} className="flex items-start gap-2 px-3 py-2 border-b border-border last:border-b-0">
            <FileText size={13} className="text-green-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-white truncate">{file.path}</p>
              {typeof file.size === 'number' && (
                <p className="text-[11px] text-muted-foreground">{file.size} bytes</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportSummaryView({ summary }: { summary: ExportSummary }) {
  return (
    <div className="space-y-3">
      {summary.exported.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Exported</p>
          <div className="max-h-48 overflow-auto rounded border border-border bg-background/50">
            {summary.exported.map((item) => (
              <div key={item.outputPath} className="flex items-start gap-2 px-3 py-2 border-b border-border last:border-b-0">
                <FileText size={13} className="text-green-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-white truncate">{item.outputPath}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.templateType.label} from {item.sourcePath}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.skipped.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Skipped</p>
          <div className="max-h-32 overflow-auto rounded border border-border bg-background/50">
            {summary.skipped.map((item) => (
              <div key={`${item.sourcePath}:${item.reason}`} className="px-3 py-2 border-b border-border last:border-b-0">
                <p className="text-xs text-muted-foreground truncate">{item.sourcePath}</p>
                <p className="text-[11px] text-muted-foreground/80">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
