import { useEffect } from 'react';

export function useKeyboardShortcuts(
  handleSave: () => void,
  setShowTemplateModal: (v: boolean) => void,
  setShowHelp: (fn: (prev: boolean) => boolean) => void,
) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl+Shift+N for new from template
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        setShowTemplateModal(true);
      }
      // F1 for help
      if (e.key === 'F1') {
        e.preventDefault();
        setShowHelp(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, setShowTemplateModal, setShowHelp]);
}