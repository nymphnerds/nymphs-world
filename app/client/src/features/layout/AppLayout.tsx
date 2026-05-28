import type { ReactNode } from 'react';

interface AppLayoutProps {
  /** Top header bar */
  header: ReactNode;
  /** Hidden inputs, modals, etc. (rendered after header but outside the main flex) */
  overlayContent?: ReactNode;
  /** Left panel content (FileExplorer, Search, etc.) — pass null to hide */
  leftPanel: ReactNode | null;
  /** ActivityBar component */
  activityBar: ReactNode;
  /** Toggle button shown when left panel is collapsed */
  collapsedToggle: ReactNode | null;
  /** Whether left panel is visible */
  leftPanelVisible: boolean;
  /** Resizer drag handler for left panel */
  onLeftResizerMouseDown: (e: React.MouseEvent) => void;
  /** Center panel content (TabBar + Editor/Welcome) */
  mainContent: ReactNode;
  /** Right panel content (ChatPanel) — pass null to hide */
  rightPanel: ReactNode | null;
  /** Whether right panel is visible */
  rightPanelVisible: boolean;
  /** Resizer drag handler for right panel */
  onRightResizerMouseDown: (e: React.MouseEvent) => void;
  /** Status bar at bottom */
  statusBar: ReactNode;
  /** Full-screen modals/dialogs rendered at root level */
  modalContent?: ReactNode;
}

/**
 * Pure presentational layout component.
 * Renders the grid/flexbox structure: Header | ActivityBar | LeftPanel | EditorArea | RightPanel | StatusBar.
 * No business logic — just layout structure and resize handle rendering.
 */
export function AppLayout({
  header,
  overlayContent,
  leftPanel,
  activityBar,
  collapsedToggle,
  leftPanelVisible,
  onLeftResizerMouseDown,
  mainContent,
  rightPanel,
  rightPanelVisible,
  onRightResizerMouseDown,
  statusBar,
  modalContent,
}: AppLayoutProps) {
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {header}

      {overlayContent}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel Group */}
        {leftPanelVisible && leftPanel && (
          <>
            {/* Activity Bar */}
            {activityBar}

            {/* Left Panel Content */}
            {leftPanel}
          </>
        )}

        {/* Collapsed Panel Toggle */}
        {collapsedToggle}

        {/* Left Resizer */}
        {leftPanelVisible && leftPanel && (
          <div className="resizer" onMouseDown={onLeftResizerMouseDown} />
        )}

        {/* Center Panel */}
        <div className="flex flex-col min-w-[300px] flex-1">
          {mainContent}
        </div>

        {/* Right Panel Group */}
        {rightPanelVisible && rightPanel && (
          <>
            {/* Right Resizer */}
            <div className="resizer" onMouseDown={onRightResizerMouseDown} />

            {rightPanel}
          </>
        )}
      </div>

      {statusBar}

      {modalContent}
    </div>
  );
}