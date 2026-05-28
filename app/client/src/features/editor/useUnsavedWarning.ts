import { useEffect } from 'react';

interface TabWithDirty {
  dirty: boolean;
}

type TabsMap = Record<string, TabWithDirty>;

export function useUnsavedWarning(tabs: TabsMap) {
  // Warn before leaving with unsaved changes
  useEffect(() => {
    const hasUnsaved = Object.values(tabs).some(tab => tab.dirty);
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
        // Legacy browsers ignore the message but require it to trigger the dialog
        (e as any).returnValue = '';
      }
    };
    if (hasUnsaved) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tabs]);
}