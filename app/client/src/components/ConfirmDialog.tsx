import { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  secondaryLabel?: string;
  confirmVariant?: 'default' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
  onSecondary?: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  secondaryLabel,
  confirmVariant = 'default',
  onCancel,
  onConfirm,
  onSecondary,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const confirmBtnStyle = confirmVariant === 'danger'
    ? { background: 'hsl(var(--danger))', color: 'hsl(var(--danger-text, #fff))' }
    : {};

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px', maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onCancel} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="modal-actions">
          {secondaryLabel && (
            <button
              className="btn-secondary"
              onClick={onSecondary}
              style={{ borderStyle: 'dashed', borderColor: 'rgb(var(--destructive) / 0.5)', color: 'rgb(var(--destructive))' }}
              title="Discard changes without saving"
            >
              {secondaryLabel}
            </button>
          )}
          <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button
            className="btn-primary"
            onClick={onConfirm}
            style={confirmBtnStyle}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}