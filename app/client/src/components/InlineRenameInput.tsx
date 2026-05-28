import { useRef, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

interface InlineRenameInputProps {
  value: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
  className?: string;
}

export function InlineRenameInput({ value, onConfirm, onCancel, className = '' }: InlineRenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value);
  const originalValue = value;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Select the name part (without extension for files)
      const dotIndex = value.lastIndexOf('.');
      inputRef.current.setSelectionRange(0, dotIndex > 0 ? dotIndex : value.length);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Confirm on blur if value changed
    if (text.trim() && text.trim() !== originalValue) {
      handleConfirm();
    } else {
      handleCancel();
    }
  };

  const handleConfirm = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== originalValue) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  const handleCancel = () => {
    setText(originalValue);
    onCancel();
  };

  const isDirty = text.trim() !== originalValue && text.trim().length > 0;

  return (
    <div className={`flex items-center gap-0.5 flex-1 min-w-0 ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="flex-1 min-w-0 rounded bg-[#2a2a3a] px-1.5 py-0.5 text-sm text-[#e0e0e0] focus:outline-none focus:ring-1 focus:ring-[#a78bfa] border border-[#3a3a4a]"
      />
      <button
        onClick={handleConfirm}
        disabled={!isDirty}
        className="flex-shrink-0 p-0.5 rounded transition-colors hover:bg-[#2a2a3a] disabled:opacity-30"
        title="Confirm"
      >
        <Check size={12} className="text-green-400" />
      </button>
      <button
        onClick={handleCancel}
        className="flex-shrink-0 p-0.5 rounded transition-colors hover:bg-[#2a2a3a] text-[#888] hover:text-red-400"
        title="Cancel"
      >
        <X size={12} />
      </button>
    </div>
  );
}