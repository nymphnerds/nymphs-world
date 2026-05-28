import { X, Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { ImageGenState } from '../hooks/useImageGeneration';

interface GenerateImageModalProps {
  status: ImageGenState;
  loading: boolean;
  progress: number;
  lastImageUrl: string | null;
  error: string | null;
  onClose: () => void;
  onInsertImage: (url: string) => void;
}

export function GenerateImageModal({
  status,
  loading,
  progress,
  lastImageUrl,
  error,
  onClose,
  onInsertImage,
}: GenerateImageModalProps) {
  const getStatusText = () => {
    switch (status) {
      case 'starting': return 'Starting Z-Image server...';
      case 'generating': return `Generating... ${Math.round(progress)}%`;
      case 'complete': return 'Generation complete!';
      case 'error': return error || 'Error occurred';
      default: return 'Preparing...';
    }
  };

  const isDone = status === 'complete' || status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl w-[90vw] max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-400" />
            Generate Image
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-6 flex flex-col items-center gap-4">
          {/* Progress phase */}
          {(status === 'starting' || status === 'generating') && (
            <>
              <Loader2 size={40} className="animate-spin text-blue-400" />
              <p className="text-sm text-gray-300">{getStatusText()}</p>
              <div style={{ width: '100%', marginTop: '8px' }}>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--border, #444)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: status === 'starting'
                        ? 'var(--warning, #fbbf24)'
                        : 'var(--accent, #8b5cf6)',
                      transition: 'width 0.3s ease',
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 text-center">
                  {Math.round(progress)}%
                </p>
              </div>
            </>
          )}

          {/* Complete phase */}
          {status === 'complete' && lastImageUrl && (
            <>
              <CheckCircle size={40} className="text-green-400" />
              <p className="text-sm text-gray-200 font-medium">Image Generated!</p>
              <img
                src={lastImageUrl}
                alt="Generated"
                style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #444)',
                }}
              />
            </>
          )}

          {/* Error phase */}
          {status === 'error' && (
            <>
              <div style={{ fontSize: '40px' }}>⚠️</div>
              <p className="text-sm text-red-400">{getStatusText()}</p>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Close
          </button>
          {status === 'complete' && lastImageUrl && (
            <button
              className="btn-primary"
              onClick={() => onInsertImage(lastImageUrl!)}
              style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={14} />
              Insert into Document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}