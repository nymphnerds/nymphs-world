import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface LayoutContextValue {
  leftWidth: number;
  rightWidth: number;
  searchWidth: number;
  leftPanelHidden: boolean;
  showAISidebar: boolean;
  toggleAISidebar: () => void;
  toggleLeftPanel: () => void;
  resizeLeftPanel: (e: React.MouseEvent) => void;
  resizeRightPanel: (e: React.MouseEvent) => void;
  resizeSearchPanel: (e: React.MouseEvent) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: LayoutContextValue;
}) {
  const stableValue = useMemo(
    () => value,
    [
      value.leftWidth,
      value.rightWidth,
      value.searchWidth,
      value.leftPanelHidden,
      value.showAISidebar,
      value.toggleAISidebar,
      value.toggleLeftPanel,
      value.resizeLeftPanel,
      value.resizeRightPanel,
      value.resizeSearchPanel,
    ],
  );

  return (
    <LayoutContext.Provider value={stableValue}>{children}</LayoutContext.Provider>
  );
}

export function useLayoutContext(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayoutContext must be used within a LayoutProvider');
  }
  return ctx;
}