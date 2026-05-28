import { ConfirmDialog } from './ConfirmDialog';
import { PromptDialog } from './PromptDialog';
import { FolderPickerDialog } from './FolderPickerDialog';
import { NewFromTemplateModal } from './NewFromTemplateModal';
import { CompileStoryBibleModal } from './CompileStoryBibleModal';
import { GenerateDocumentModal } from './GenerateDocumentModal';
import GraphModal from './GraphModal';
import { HelpPanel } from './HelpPanel';
import type { FileItem, GraphNode, GraphEdge } from '../services/api';

export interface AppDialogsProps {
  showTemplateModal: boolean;
  showCompileModal: boolean;
  showGenerateModal: boolean;
  showHelp: boolean;
  confirmOpen: boolean;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'default';
  confirmSecondaryLabel: string;
  promptOpen: boolean;
  promptTitle: string;
  promptMessage: string;
  promptDefault: string;
  promptPlaceholder: string;
  promptConfirmLabel: string;
  folderPickerOpen: boolean;
  folderPickerDefault: string;
  graphModalData: { nodes: GraphNode[]; edges: GraphEdge[]; model: string } | null;
  explorerPath: string;
  files: FileItem[];

  onCloseTemplate: () => void;
  onCloseCompile: () => void;
  onCloseGenerate: () => void;
  onTemplateSuccess: (path: string, content: string) => void;
  onCompileSuccess: (path: string, content: string) => void;
  onFileCreated: (path: string) => void;
  onOpenFile: (path: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onSecondary: (() => void) | undefined;
  onPromptCancel: () => void;
  onPromptConfirm: (value: string) => void;
  onFolderPickerCancel: () => void;
  onFolderPickerConfirm: (folderPath: string) => void;
  onCloseGraph: () => void;
  onCloseHelp: () => void;
}

export function AppDialogs(props: AppDialogsProps) {
  const {
    showTemplateModal, showCompileModal, showGenerateModal, showHelp,
    confirmOpen, confirmTitle, confirmMessage, confirmLabel, confirmVariant, confirmSecondaryLabel,
    promptOpen, promptTitle, promptMessage, promptDefault, promptPlaceholder, promptConfirmLabel,
    folderPickerOpen, folderPickerDefault, graphModalData,
    explorerPath, files,
    onCloseTemplate, onCloseCompile, onCloseGenerate,
    onTemplateSuccess, onCompileSuccess, onFileCreated, onOpenFile,
    onConfirm, onCancel, onSecondary,
    onPromptCancel, onPromptConfirm,
    onFolderPickerCancel, onFolderPickerConfirm,
    onCloseGraph, onCloseHelp,
  } = props;

  return (
    <>
      {/* New from Template Modal */}
      {showTemplateModal && (
        <NewFromTemplateModal
          defaultFolder={explorerPath}
          onClose={onCloseTemplate}
          onSuccess={onTemplateSuccess}
        />
      )}

      {/* Compile Story Bible Modal */}
      {showCompileModal && (
        <CompileStoryBibleModal
          selectedFiles={files}
          currentFolder={explorerPath}
          allFiles={files}
          onClose={onCloseCompile}
          onSuccess={onCompileSuccess}
        />
      )}

      {/* Generate Document with AI Modal */}
      {showGenerateModal && (
        <GenerateDocumentModal
          onClose={onCloseGenerate}
          onFileCreated={onFileCreated}
        />
      )}

      {/* Custom Confirm Dialog (replaces window.confirm) */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        cancelLabel="Cancel"
        secondaryLabel={confirmSecondaryLabel || undefined}
        confirmVariant={confirmVariant}
        onCancel={onCancel}
        onConfirm={onConfirm}
        onSecondary={onSecondary}
      />

      {/* Graph Modal */}
      {graphModalData && (
        <GraphModal
          nodes={graphModalData.nodes}
          edges={graphModalData.edges}
          model={graphModalData.model}
          onClose={onCloseGraph}
          onNodeClick={(nodeId: string) => onOpenFile(nodeId)}
        />
      )}

      {/* Help Panel */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onCloseHelp}>
          <div
            className="bg-[#1e1e2e] rounded-lg shadow-2xl border border-[#3a3a4a] w-[85vw] max-w-4xl h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <HelpPanel onClose={onCloseHelp} />
          </div>
        </div>
      )}

      {/* Custom Prompt Dialog (replaces prompt) */}
      <PromptDialog
        open={promptOpen}
        title={promptTitle}
        message={promptMessage}
        defaultValue={promptDefault}
        placeholder={promptPlaceholder}
        confirmLabel={promptConfirmLabel}
        onCancel={onPromptCancel}
        onConfirm={onPromptConfirm}
      />

      {/* Folder Picker Dialog (replaces prompt for folder selection) */}
      <FolderPickerDialog
        open={folderPickerOpen}
        defaultFolder={folderPickerDefault}
        message="Select a destination folder for the move."
        onCancel={onFolderPickerCancel}
        onConfirm={onFolderPickerConfirm}
      />
    </>
  );
}