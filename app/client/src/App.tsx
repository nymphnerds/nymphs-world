import { useState, useCallback, useEffect, useRef } from 'react';
import { FileExplorer } from './components/FileExplorer';
import { DocumentEditor } from './components/DocumentEditor';
import { TabBar } from './components/TabBar';
import { ChatPanel } from './components/ChatPanel';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { Welcome } from './components/Welcome';
import { NewFromTemplateModal } from './components/NewFromTemplateModal';
import { CompileStoryBibleModal } from './components/CompileStoryBibleModal';
import { GenerateDocumentModal } from './components/GenerateDocumentModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { PromptDialog } from './components/PromptDialog';
import { FolderPickerDialog } from './components/FolderPickerDialog';
import { ImageGeneratorPanel } from './components/ImageGeneratorPanel';
import { BookmarkSidebar } from './components/BookmarkSidebar';
import { ReminderSidebar } from './components/ReminderSidebar';
import { GameExportModal } from './components/GameExportModal';
import ActivityBar from './components/ActivityBar';
import SearchPanel from './components/SearchPanel';
import TagManager from './components/TagManager';
import LocationManager from './components/LocationManager';
import StarredFiles from './components/StarredFiles';
import TimelineView from './components/TimelineView';
import RelationshipGraphSidebar from './components/RelationshipGraphSidebar';
import GraphModal from './components/GraphModal';
import { DialogueSidebar } from './components/DialogueSidebar';
import { DialogueEditorModal } from './components/DialogueEditorModal';
import SceneConversationDesigner from './components/SceneConversationDesigner';
import { useBookmarks } from './hooks/useBookmarks';
import { Settings } from './pages/Settings';
import { useAuthContext } from './features/auth/AuthProvider';
import { useLayout } from './features/layout/useLayout';
import { useActivityRouter, type ActivityType } from './features/navigation/useActivityRouter';
import { useSettings } from './features/navigation/useSettings';
import { useImageConversion } from './features/editor/useImageConversion';
import { useUnsavedWarning } from './features/editor/useUnsavedWarning';
import { useGraphManager } from './features/graph/useGraphManager';
import { useKeyboardShortcuts } from './features/keyboard/useKeyboardShortcuts';
import { useFileOperations, isImageFile, isDocxFile } from './features/files/useFileOperations';
import { useSearch } from './hooks/useSearch';
import { useRecents } from './hooks/useRecents';
import { useLLM } from './hooks/useLLM';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { applyThemeColours } from './hooks/useTheme';
import { FileItem, signImageFromWorkspace, createFile, updateFile } from './services/api';
import { ProfileSelectorModal } from './components/ProfileSelectorModal';
import { HelpPanel } from './components/HelpPanel';
import MaintenanceModal from './components/maintenance/MaintenanceModal';

export default function App() {
  const { user, isAuthenticated, isNewUser, login, logout, clearNewUserFlag } = useAuthContext();
  const layout = useLayout();
  const { leftWidth, setLeftWidth, rightWidth, setRightWidth, searchWidth, setSearchWidth,
           leftPanelHidden, setLeftPanelHidden, showAISidebar, setShowAISidebar,
           toggleAISidebar, toggleLeftPanel, resizeLeftPanel, resizeRightPanel,
           hiddenIcons, visibilityRefreshKey } = layout;
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCompileModal, setShowCompileModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showGameExportModal, setShowGameExportModal] = useState(false);
  const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  // Dialogue modal state
  const [dialogueScene, setDialogueScene] = useState<any>(null);

  const handleOpenDialogue = useCallback((scene: any) => {
    setDialogueScene(scene);
  }, []);

  const handleCloseDialogue = useCallback(() => {
    setDialogueScene(null);
  }, []);

  // Maintenance modal state
  const [showMaintenance, setShowMaintenance] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Graph manager (called early — graphModalData state lives inside the hook)
  const graphManager = useGraphManager(user?.username);
  const { graphModalData, loading: graphLoading, error: graphError, hasCache: graphHasCache,
           handleGenerate, handleViewCached, handleClear, handleOpenGraph, handleCloseModal } = graphManager;

  // Confirm dialog state (replaces native window.confirm)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('Confirm');
  const [confirmVariant, setConfirmVariant] = useState<'default' | 'danger'>('default');
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);
  const [confirmSecondaryLabel, setConfirmSecondaryLabel] = useState('');
  const [confirmSecondaryCallback, setConfirmSecondaryCallback] = useState<(() => void) | null>(null);

  // Stable refs for callbacks to prevent stale invocation during re-renders
  const confirmCallbackRef = useRef<(() => void) | null>(null);
  const confirmSecondaryCallbackRef = useRef<(() => void) | null>(null);

  // Prompt dialog state (replaces native prompt)
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptMessage, setPromptMessage] = useState('');
  const [promptDefault, setPromptDefault] = useState('');
  const [promptPlaceholder, setPromptPlaceholder] = useState('');
  const [promptConfirmLabel, setPromptConfirmLabel] = useState('OK');
  const [promptCallback, setPromptCallback] = useState<((value: string) => void) | null>(null);

  // Folder picker dialog state (replaces prompt for folder selection)
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerDefault, setFolderPickerDefault] = useState('');
  const [folderPickerCallback, setFolderPickerCallback] = useState<((folderPath: string) => void) | null>(null);

  /** Show a confirmation dialog, returning true/false via callback pattern */
  const showConfirm = useCallback((title: string, message: string, label?: string, variant?: 'default' | 'danger'): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmTitle(title);
      setConfirmMessage(message);
      setConfirmLabel(label || 'Confirm');
      setConfirmVariant(variant || 'default');
      setConfirmOpen(true);
      setConfirmCallback(() => () => resolve(true));
      // Store the cancel handler
      (window as any).__confirmCancelHandler = () => resolve(false);
    });
  }, []);

  /** Show a prompt dialog, returning the user input or null on cancel */
  const showPrompt = useCallback((title: string, message?: string, defaultValue?: string, placeholder?: string, confirmLabel?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptTitle(title);
      setPromptMessage(message || '');
      setPromptDefault(defaultValue || '');
      setPromptPlaceholder(placeholder || '');
      setPromptConfirmLabel(confirmLabel || 'OK');
      setPromptOpen(true);
      setPromptCallback(() => (v: string) => resolve(v));
    });
  }, []);

  /** Show a folder picker dialog, returning the selected folder path or null on cancel */
  const showFolderPicker = useCallback((defaultFolder?: string): Promise<string> => {
    return new Promise((resolve) => {
      setFolderPickerDefault(defaultFolder || '');
      setFolderPickerOpen(true);
      setFolderPickerCallback(() => (fp: string) => resolve(fp));
    });
  }, []);

  const nav = useActivityRouter(toggleLeftPanel, setLeftPanelHidden);
  const { activeActivity, setActiveActivity, tagsShowAddTag, handleActivitySwitch, handleOpenTagSidebar } = nav;
  const { showSettings, setShowSettings } = useSettings();

  // Refresh key for recents/starred data - increments on login to force re-fetch
  const [recentsRefreshKey, setRecentsRefreshKey] = useState(0);

  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults, loading: searchLoading, error: searchError } = useSearch();
  const { recentFiles, starredFiles, addRecentFile, toggleStar, removeRecent, removeStar, clearRecents } = useRecents(recentsRefreshKey);
  const { getBookmarks, addBookmark, removeBookmark, parseHeadings } = useBookmarks();
  const [imageToInsert, setImageToInsert] = useState<{ src: string; alt: string } | null>(null);
  const importDocxInputRef = useRef<HTMLInputElement | null>(null);
  const mainEditorRef = useRef<HTMLDivElement | null>(null);

  // Track auth transitions to reset sidebar on fresh login
  const prevAuthRef = useRef(isAuthenticated);

  const fileOps = useFileOperations(showFolderPicker);
  const {
    files,
    currentPath,
    content,
    loading,
    error,
    setContent,
    tabs,
    activeTabId,
    loadFiles,
    openFile,
    openTab,
    saveCurrentFile,
    saveTab,
    restoreToOriginal,
    newFile,
    newFolder,
    deleteSelected,
    renameSelected,
    copySelected,
    moveSelected,
    uploadImageFile,
    uploadFileToFolder,
    closeTab,
    switchTab,
    updateTabContent,
    closeOtherTabs,
    dirtyTabIdsRef,
    closeAllTabs,
    batchDelete,
    batchCopy,
    batchMove,
    canUndo,
    reloadTab,
    canRedo,
    undoFs,
    redoFs,
    explorerPath,
    setExplorerPath,
  } = fileOps;

  const {
    chatHistory,
    loading: llmLoading,
    llmConnected,
    aiOffline,
    sendMessage,
    clearChat,
    toolsEnabled,
    setToolsEnabled,
    refreshLlmHealth,
    messagesTrimmed,
    dismissTrimNotification,
  } = useLLM();

  // Reset AI sidebar visibility on fresh login (not on page refresh)
  // Also re-run LLM health check so AI features reflect the logged-in user's settings
  // Also refresh recents/starred data to ensure we fetch the correct user's data
  useEffect(() => {
    const wasUnauthenticated = !prevAuthRef.current;
    const isNowAuthenticated = isAuthenticated;
    if (wasUnauthenticated && isNowAuthenticated) {
      setShowAISidebar(false);
      localStorage.removeItem('wbu-ai-sidebar');
      // Re-check LLM health now that user is authenticated
      refreshLlmHealth();
      // Force refresh recents/starred from server for the newly logged-in user
      setRecentsRefreshKey(k => k + 1);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, refreshLlmHealth]);

  // Initialize theme on app startup
  useEffect(() => {
    try {
      const raw = localStorage.getItem('wbu_theme_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.colours && parsed?.mode) {
          applyThemeColours(parsed.colours, parsed.mode);
          document.documentElement.setAttribute('data-theme', parsed.mode);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Load file list on initial mount so the explorer populates
  useEffect(() => {
    loadFiles('');
  }, []);

  // Session restore handler
  const handleSessionRestore = useCallback(async (session: {
    tabs: string[];
    activeTabPath: string | null;
    explorerPath: string;
    activeActivity: string;
    showAISidebar: boolean;
  }) => {
    // Restore activity first
    if (session.activeActivity) {
      setActiveActivity(session.activeActivity as ActivityType);
    }

    // Restore explorer path
    if (session.explorerPath) {
      setExplorerPath(session.explorerPath);
      await loadFiles(session.explorerPath);
    }

    // Restore tabs sequentially, tracking the last successfully opened tab
    let lastOpenedPath: string | null = null;
    if (session.tabs && session.tabs.length > 0) {
      for (const path of session.tabs) {
        const result = await openTab(path);
        if (result) {
          lastOpenedPath = path;
        }
        // Silently skip files that no longer exist (openTab returns null)
      }
    }

    // Activate the previously active tab if it wasn't the last one opened
    if (session.activeTabPath && session.activeTabPath !== lastOpenedPath) {
      await openTab(session.activeTabPath);
    }
  }, [loadFiles, openTab]);

  // Wire up session persistence
  useSessionPersistence({
    tabs,
    activeTabId,
    explorerPath,
    activeActivity,
    showAISidebar,
    isAuthenticated,
    onRestore: handleSessionRestore,
  });


  // Track recently opened files
  const trackRecent = useCallback((path: string) => {
    addRecentFile(path);
  }, [addRecentFile]);

  const { convertServerUrlsToProxyUrls, convertProxyUrlsToServerUrls } = useImageConversion();

  // Wrap save to convert proxy URLs back to server URLs before saving
  const handleSave = useCallback(async () => {
    const tab = activeTabId ? tabs[activeTabId] : null;
    if (!tab) return;
    const contentToSave = convertProxyUrlsToServerUrls(tab.content);
    await saveCurrentFile(contentToSave);
  }, [activeTabId, tabs, convertProxyUrlsToServerUrls, saveCurrentFile]);

  // Restore file to last saved version (called from DocumentEditor after confirm)
  const handleRestore = useCallback(() => {
    const tab = activeTabId ? tabs[activeTabId] : null;
    if (!tab || tab.content === tab.originalContent) return;
    restoreToOriginal();
  }, [activeTabId, tabs, restoreToOriginal]);

  // Wrap openFile to convert server URLs to signed proxy URLs for display
  const openFileWithConversion = useCallback(async (path: string) => {
    trackRecent(path);
    const result = await openFile(path);
    if (!result) return;
    const { content: fileContent, id: tabId } = result;

    const converted = await convertServerUrlsToProxyUrls(fileContent);
    if (converted !== fileContent) {
      await new Promise(resolve => setTimeout(resolve, 0));
      updateTabContent(tabId, converted);
    }
  }, [openFile, convertServerUrlsToProxyUrls, updateTabContent, trackRecent]);

  const handleFileSelect = useCallback(async (file: FileItem) => {
    if (file.type === 'file') {
      if (isImageFile(file.name)) {
        if (!activeTabId || !tabs[activeTabId]) {
          alert(`No document is open. Open a text file first to insert '${file.name}'.`);
          return;
        }
        const activeTab = tabs[activeTabId];
        setConfirmTitle('Insert Image');
        setConfirmMessage(`Insert image "${file.name}" into "${activeTab.name}"?`);
        setConfirmLabel('Insert');
        setConfirmSecondaryLabel('');
        setConfirmVariant('default');
        setConfirmOpen(true);
        setConfirmCallback(() => async () => {
          try {
            const signedUrl = await signImageFromWorkspace(file.path);
            setImageToInsert({ src: signedUrl, alt: file.name });
          } catch (err) {
            console.error('Failed to load image:', err);
            alert(`Failed to load image "${file.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        });
        (window as any).__confirmCancelHandler = null;
        return;
      }
      await openFileWithConversion(file.path);
    } else if (file.type === 'folder') {
      setExplorerPath(file.path);
      loadFiles(file.path);
    }
  }, [openFileWithConversion, loadFiles, activeTabId, tabs]);

  const handleNewFile = useCallback(async () => {
    // Always show folder picker — default to NPCs folder (no files in root)
    let targetFolder = await showFolderPicker('NPCs');
    if (!targetFolder) return; // user cancelled

    // Prompt for file name using the themed PromptDialog
    const fileName = await showPrompt(
      'New Blank File',
      'Enter a name for the new file:',
      '',
      'File name...',
      'Create'
    );
    if (!fileName) return; // user cancelled

    const createdPath = await newFile(targetFolder, fileName.trim());
    if (createdPath) {
      // Sync explorer to the folder where the file was created
      setExplorerPath(targetFolder);
      loadFiles(targetFolder);
      // Open the newly created file in the editor
      await openFileWithConversion(createdPath);
    }
  }, [explorerPath, showFolderPicker, showPrompt, newFile, setExplorerPath, loadFiles, openFileWithConversion]);

  const handleCreateFileFromEditor = useCallback(async () => {
    // Always show folder picker — default to NPCs folder (no files in root)
    let targetFolder = await showFolderPicker('NPCs');
    if (!targetFolder) return; // user cancelled

    // Prompt for file name using the themed PromptDialog
    const fileName = await showPrompt(
      'New Blank File',
      'Enter a name for the new file:',
      '',
      'File name...',
      'Create'
    );
    if (!fileName) return; // user cancelled

    const createdPath = await newFile(targetFolder, fileName.trim());
    if (createdPath) {
      // Sync explorer to the folder where the file was created
      setExplorerPath(targetFolder);
      loadFiles(targetFolder);
      // Open the newly created file in the editor
      await openFileWithConversion(createdPath);
    }
  }, [explorerPath, showFolderPicker, showPrompt, newFile, setExplorerPath, loadFiles, openFileWithConversion]);

  const handleDelete = useCallback((item: FileItem) => {
    const warningMsg = item.type === 'folder'
      ? `Delete folder '${item.name}' and all its contents? This cannot be undone.`
      : `Delete file '${item.name}'?`;
    setConfirmTitle(item.type === 'folder' ? 'Delete Folder' : 'Delete File');
    setConfirmMessage(warningMsg);
    setConfirmLabel('Delete');
    setConfirmSecondaryLabel('');
    setConfirmVariant('danger');
    setConfirmOpen(true);
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '';
    setConfirmCallback(() => {
      deleteSelected(item.path, parentPath);
    });
    (window as any).__confirmCancelHandler = null;
  }, [deleteSelected]);

  const handleRename = useCallback((item: FileItem, newName: string) => {
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '';
    renameSelected(item.path, newName, parentPath);
  }, [renameSelected]);

  const handleCopy = useCallback((item: FileItem) => {
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '';
    copySelected(item.path, parentPath);
  }, [copySelected]);

  const handleMove = useCallback((item: FileItem) => {
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '';
    moveSelected(item.path, parentPath);
  }, [moveSelected]);

  const handleBack = useCallback(() => {
    const parts = explorerPath.split('/');
    parts.pop();
    const newPath = parts.join('/') || '';
    setExplorerPath(newPath);
    loadFiles(newPath);
  }, [explorerPath, loadFiles]);

  const handleBackToRoot = useCallback(() => {
    setExplorerPath('');
    loadFiles('');
  }, [loadFiles]);

  const handleBackToSegment = useCallback((path: string) => {
    setExplorerPath(path);
    loadFiles(path);
  }, [loadFiles]);

  const handleNewFolder = useCallback(() => {
    const name = prompt('Enter folder name:');
    if (!name || !name.trim()) return;
    newFolder(explorerPath, name.trim());
  }, [explorerPath, newFolder]);

  const handleUploadFiles = useCallback(async (fileList: FileList) => {
    let targetFolder = explorerPath;

    if (!targetFolder) {
      const folders = files.filter(f => f.type === 'folder').map(f => f.name);
      if (folders.length === 0) {
        alert('No folders available. Please create a folder first.');
        return;
      }
      const folderList = folders.map((f, i) => `${i + 1}. ${f}`).join('\n');
      const selection = prompt(
        `Select a folder for the upload:\n${folderList}\n\nEnter folder number (or type a new folder name to create):`
      );
      if (!selection) return;

      const idx = parseInt(selection, 10) - 1;
      if (idx >= 0 && idx < folders.length) {
        targetFolder = folders[idx];
      } else {
        const trimmed = selection.trim();
        if (!trimmed) return;
        await newFolder('', trimmed);
        targetFolder = trimmed;
      }
    }

    for (const file of Array.from(fileList)) {
      // Handle DOCX upload -> convert to HTML
      if (isDocxFile(file.name)) {
        try {
          // @ts-ignore - mammoth.browser has no types
          const mammothModule = await import('mammoth/mammoth.browser');
          const mammoth: any = mammothModule.default;
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });

          const baseName = file.name.replace(/\.docx$/i, '');
          const htmlPath = await newFile(targetFolder, `${baseName}.html`);
          if (htmlPath) {
            await updateFile(htmlPath, result.value);
            await openFileWithConversion(htmlPath);
          }
          if (result.messages.length > 0) console.warn('[v4.12] DOCX upload warnings:', result.messages);
        } catch (err) {
          alert(`DOCX import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        continue;
      }
      await uploadFileToFolder(file, targetFolder);
    }
    loadFiles(targetFolder);
  }, [explorerPath, files, uploadFileToFolder, loadFiles, newFolder]);

  // Dirty tab close handler — shows 3-button confirmation dialog (Save / Don't Save / Cancel)
  const handleConfirmDirtyClose = useCallback((tabId: string, tabName: string) => {
    setConfirmTitle('Unsaved Changes');
    setConfirmMessage(`You have unsaved changes in "${tabName}". What would you like to do?`);
    setConfirmLabel('Save');
    setConfirmSecondaryLabel("Don't Save");
    setConfirmVariant('default');
    // Store callbacks in refs to avoid React state batching causing premature invocation
    confirmCallbackRef.current = async () => {
      await saveTab(tabId);
      closeTab(tabId);
    };
    confirmSecondaryCallbackRef.current = () => {
      closeTab(tabId);
    };
    setConfirmOpen(true);
    // Cancel does nothing (just closes the dialog)
    (window as any).__confirmCancelHandler = null;
  }, [closeTab, saveTab]);

  // Dirty check — use dirtyTabIdsRef (synchronous, bypasses React batching)
  // and also fall back to tab.dirty from state.
  // TabBar delegates all close requests to this handler.
  const handleTabClose = useCallback((id: string) => {
    const refDirty = dirtyTabIdsRef.current.has(id);
    const stateDirty = tabs[id]?.dirty;
    const isDirty = refDirty || stateDirty;
    const tab = tabs[id];
    if (isDirty && tab) {
      handleConfirmDirtyClose(id, tab.name);
      return;
    }
    closeTab(id);
  }, [closeTab, tabs, handleConfirmDirtyClose]);

  const handleTabSwitch = useCallback((id: string) => {
    switchTab(id);
  }, [switchTab]);

  const handleTabCloseOthers = useCallback((id: string) => {
    closeOtherTabs(id);
  }, [closeOtherTabs]);

  const handleTabCloseAll = useCallback(() => {
    closeAllTabs();
  }, [closeAllTabs]);

  // Download the current file as HTML
  const handleDownload = useCallback(async () => {
    const tab = activeTabId ? tabs[activeTabId] : null;
    if (!tab) return;
    try {
      const encodedPath = tab.path.split('/').map(seg => encodeURIComponent(seg)).join('/');
      const url = `${window.location.origin}/api/files/workspace/${encodedPath}`;
      const token = localStorage.getItem('wbu_token');
      const response = await fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      });
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = tab.name.endsWith('.html') ? tab.name : `${tab.name}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [activeTabId, tabs]);

  // Export current editor content as PDF using html2pdf.js
  const handleExportPDF = useCallback(async () => {
    const tab = activeTabId ? tabs[activeTabId] : null;
    if (!tab) return;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      // Create a temporary container with the editor HTML
      const container = document.createElement('div');
      container.innerHTML = tab.content;
      container.style.padding = '20mm';
      container.style.fontFamily = 'Arial, sans-serif';
      container.style.fontSize = '12pt';
      container.style.lineHeight = '1.6';
      // Hide the split delimiter if present
      container.innerHTML = container.innerHTML.replace(/<!-- MARGIN_SPLIT -->/g, '<hr style="margin: 20px 0; border: 1px solid #ccc;">');
      document.body.appendChild(container);
      const fileName = tab.name.replace(/\.html$/i, '') || 'document';
      html2pdf().set({
        margin: 10,
        filename: `${fileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(container).save().then(() => {
        document.body.removeChild(container);
      });
    } catch (err) {
      alert(`PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [activeTabId, tabs]);

  // Export as DOCX (2-column layout preserved as table)
  const handleExportDOCX = useCallback(async () => {
    const tab = activeTabId ? tabs[activeTabId] : null;
    if (!tab) return;
    try {
      const docx = await import('docx');
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, BorderStyle } = docx;

      const SPLIT_DELIMITER = '<!-- MARGIN_SPLIT -->';
      let mainHtml = tab.content;
      let marginHtml = '';
      if (mainHtml.includes(SPLIT_DELIMITER)) {
        const parts = mainHtml.split(SPLIT_DELIMITER);
        mainHtml = parts[0] || '';
        marginHtml = parts[1] || '';
      }

      const htmlToParagraphs = (html: string): any[] => {
        const paragraphs: any[] = [];
        if (!html.trim()) return paragraphs;
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');

        const processNode = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.trim()) paragraphs.push(new Paragraph({ children: [new TextRun({ text })] }));
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();
            if (tag === 'h1') {
              paragraphs.push(new Paragraph({ children: [new TextRun({ text: el.textContent || '', bold: true, size: 48 })], heading: HeadingLevel.HEADING_1 }));
            } else if (tag === 'h2') {
              paragraphs.push(new Paragraph({ children: [new TextRun({ text: el.textContent || '', bold: true, size: 36 })], heading: HeadingLevel.HEADING_2 }));
            } else if (tag === 'h3') {
              paragraphs.push(new Paragraph({ children: [new TextRun({ text: el.textContent || '', bold: true, size: 28 })], heading: HeadingLevel.HEADING_3 }));
            } else if (tag === 'p' || tag === 'div') {
              const children: any[] = [];
              el.childNodes.forEach((child: Node) => {
                if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) children.push(new TextRun({ text: child.textContent }));
                else if (child.nodeType === Node.ELEMENT_NODE) {
                  const c = child as HTMLElement;
                  const run: any = { text: c.textContent || '' };
                  if (c.tagName.toLowerCase() === 'b' || c.tagName.toLowerCase() === 'strong') run.bold = true;
                  if (c.tagName.toLowerCase() === 'i' || c.tagName.toLowerCase() === 'em') run.italic = true;
                  children.push(new TextRun(run));
                }
              });
              paragraphs.push(new Paragraph({ children: children.length ? children : [new TextRun('')] }));
            } else if (tag === 'br') {
              paragraphs.push(new Paragraph({ children: [] }));
            } else if (tag !== 'span' && tag !== 'img') {
              el.childNodes.forEach(child => processNode(child));
            }
          }
        };
        doc.body.childNodes.forEach(node => processNode(node));
        return paragraphs;
      };

      const mainParagraphs = htmlToParagraphs(mainHtml);
      const marginParagraphs = htmlToParagraphs(marginHtml);

      const table = new Table({
        width: { size: 100, type: 'pct' },
        rows: [new TableRow({
          children: [
            new TableCell({ width: { size: 70, type: 'pct' }, children: [...mainParagraphs] }),
            new TableCell({ width: { size: 30, type: 'pct' }, children: [...marginParagraphs] }),
          ],
        })],
        borders: {
          top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
          left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 },
          insideHorizontal: { style: BorderStyle.NONE, size: 0 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        },
      });

      const doc = new Document({ sections: [{ properties: {}, children: [table] }] });
      const blob = await Packer.toBlob(doc);
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const fileName = tab.name.replace(/\.html$/i, '') || 'document';
      a.download = `${fileName}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(`DOCX export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [activeTabId, tabs]);

  // Import DOCX via hidden file input
  const handleImportDOCX = useCallback(() => {
    importDocxInputRef.current?.click();
  }, []);

  const handleDocxFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // @ts-ignore - mammoth.browser has no types
      const mammothModule = await import('mammoth/mammoth.browser');
      const mammoth: any = mammothModule.default;
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });

      const targetFolder = prompt('Save to folder (leave empty for root):', explorerPath || '');
      if (targetFolder === null) return;
      const baseName = file.name.replace(/\.docx$/i, '');
      const htmlFileName = `${baseName}.html`;
      const fullPath = targetFolder ? `${targetFolder}/${htmlFileName}` : htmlFileName;

      await createFile(fullPath, '');
      await updateFile(fullPath, result.value);
      await openFileWithConversion(fullPath);
      loadFiles(targetFolder || '');
      if (result.messages.length > 0) console.warn('[v4.12] DOCX import warnings:', result.messages);
    } catch (err) {
      alert(`DOCX import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      if (importDocxInputRef.current) importDocxInputRef.current.value = '';
    }
  }, [explorerPath, openFileWithConversion, loadFiles]);

  // Handle template success — open the new file and navigate explorer to its folder
  const handleTemplateSuccess = useCallback(async (path: string, fileContent: string) => {
    setShowTemplateModal(false);
    // Navigate explorer to the folder where the file was created
    const folder = path.substring(0, path.lastIndexOf('/')) || '';
    setExplorerPath(folder);
    loadFiles(folder);
    await openFileWithConversion(path);
  }, [openFileWithConversion, loadFiles]);

  const handleCompileSuccess = useCallback(async (path: string, fileContent: string) => {
    setShowCompileModal(false);
    await openFileWithConversion(path);
  }, [openFileWithConversion]);

  // Keyboard shortcuts
  useKeyboardShortcuts(handleSave, setShowTemplateModal, setShowHelp);

  // Warn before leaving with unsaved changes
  useUnsavedWarning(tabs);

  // Compute dirty state from active tab
  const dirty = activeTabId ? tabs[activeTabId]?.dirty || false : false;

  // Compute canRestore state (content differs from original snapshot)
  const canRestore = activeTabId ? tabs[activeTabId]?.content !== tabs[activeTabId]?.originalContent : false;

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // --- Batch selection handlers ---
  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        setSelectedPaths(new Set());
      }
      return !prev;
    });
  }, []);

  const handleToggleSelect = useCallback((path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((items: FileItem[]) => {
    setSelectedPaths(new Set(items.map(f => f.path)));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const handleBatchDelete = useCallback((paths: string[]) => {
    const warningMsg = `Delete ${paths.length} selected item(s)? This cannot be undone.`;
    setConfirmTitle('Batch Delete');
    setConfirmMessage(warningMsg);
    setConfirmLabel('Delete');
    setConfirmSecondaryLabel('');
    setConfirmVariant('danger');
    setConfirmOpen(true);
    setConfirmCallback(() => {
      batchDelete(paths, explorerPath);
      setSelectedPaths(new Set());
      setSelectionMode(false);
    });
    (window as any).__confirmCancelHandler = null;
  }, [batchDelete, explorerPath]);

  const handleBatchCopy = useCallback(async (paths: string[]) => {
    const destFolder = await showFolderPicker(explorerPath);
    if (destFolder === null) return;
    batchCopy(paths, destFolder, explorerPath);
    setSelectedPaths(new Set());
    setSelectionMode(false);
  }, [explorerPath, showFolderPicker, batchCopy]);

  const handleBatchMove = useCallback(async (paths: string[]) => {
    const destFolder = await showFolderPicker(explorerPath);
    if (destFolder === null) return;
    batchMove(paths, destFolder, explorerPath);
    setSelectedPaths(new Set());
    setSelectionMode(false);
  }, [explorerPath, showFolderPicker, batchMove]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <Header
        onNewFile={handleNewFile}
        onCreateFromTemplate={() => setShowTemplateModal(true)}
        onImportDOCX={handleImportDOCX}
        onLogout={logout}
        username={user?.username || ''}
        showAISidebar={showAISidebar}
        onToggleAISidebar={aiOffline ? undefined : toggleAISidebar}
        aiOffline={aiOffline}
        onOpenHelp={() => setShowHelp(true)}
        onGenerateGameFile={() => setShowGameExportModal(true)}
      />

      {/* Hidden file input for DOCX import */}
      <input
        ref={importDocxInputRef}
        type="file"
        accept=".docx"
        style={{ display: 'none' }}
        onChange={handleDocxFileSelected}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel Group — hidden when leftPanelHidden */}
        {!leftPanelHidden && (
          <>
            {/* Activity Bar */}
            <ActivityBar activeActivity={activeActivity} onSwitch={handleActivitySwitch} onSettings={() => setShowSettings(prev => !prev)} onToggleAI={aiOffline ? undefined : toggleAISidebar} showAISidebar={showAISidebar} aiOffline={aiOffline} leftPanelHidden={false} onTogglePanel={toggleLeftPanel} hiddenIcons={hiddenIcons} />

            {/* Left Panel - File Explorer or Search */}
            {showSettings ? (
          <div style={{ width: leftWidth, minWidth: leftWidth, overflow: 'hidden' }}>
            <Settings onClose={() => setShowSettings(false)} onOpenMaintenance={() => setShowMaintenance(true)} />
          </div>
        ) : activeActivity === 'explorer' ? (
        <FileExplorer
          files={files}
          explorerPath={explorerPath}
          currentPath={currentPath}
          loading={loading}
          onFileSelect={handleFileSelect}
          onDelete={handleDelete}
          onRename={handleRename}
          onCopy={handleCopy}
          onMove={handleMove}
          onBack={handleBack}
          onBackToRoot={handleBackToRoot}
          onBackToSegment={handleBackToSegment}
          onNewFolder={handleNewFolder}
          onUploadFiles={handleUploadFiles}
          onCompile={() => setShowCompileModal(true)}
          width={leftWidth}
          starredFiles={starredFiles}
          onToggleStar={toggleStar}
          isStarred={(path) => starredFiles.some(s => s.path === path)}
          onUndo={undoFs}
          onRedo={redoFs}
          canUndo={canUndo}
          canRedo={canRedo}
          selectionMode={selectionMode}
          selectedPaths={selectedPaths}
          onToggleSelectionMode={handleToggleSelectionMode}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onBatchDelete={handleBatchDelete}
          onBatchCopy={handleBatchCopy}
          onBatchMove={handleBatchMove}
        />
        ) : activeActivity === 'starred' ? (
          <div style={{ width: leftWidth, minWidth: leftWidth, overflow: 'hidden' }}>
            <StarredFiles
              starredFiles={starredFiles}
              onFileSelect={(path: string) => {
                setActiveActivity('explorer');
                const folder = path.substring(0, path.lastIndexOf('/')) || '';
                setExplorerPath(folder);
                loadFiles(folder);
                openFileWithConversion(path);
              }}
              onRemoveStar={removeStar}
            />
          </div>
        ) : activeActivity === 'tags' ? (
          <div style={{ width: leftWidth, minWidth: leftWidth, overflow: 'hidden' }}>
            <TagManager
              activeFilePath={currentPath || null}
              onFileSelect={(path: string) => {
                setActiveActivity('explorer');
                const folder = path.substring(0, path.lastIndexOf('/')) || '';
                setExplorerPath(folder);
                loadFiles(folder);
                openFileWithConversion(path);
              }}
              defaultShowAddTag={activeActivity === 'tags' ? tagsShowAddTag : false}
            />
          </div>
        ) : activeActivity === 'timeline' ? (
          <div style={{ width: leftWidth, minWidth: leftWidth, overflow: 'hidden' }}>
            <TimelineView
              onFileSelect={(path: string) => {
                setActiveActivity('explorer');
                const folder = path.substring(0, path.lastIndexOf('/')) || '';
                setExplorerPath(folder);
                loadFiles(folder);
                openFileWithConversion(path);
              }}
              refreshKey={Object.keys(tabs).length}
            />
          </div>
        ) : activeActivity === 'locations' ? (
          <div style={{ width: leftWidth, minWidth: leftWidth, overflow: 'hidden' }}>
            <LocationManager
              activeFilePath={currentPath || null}
              onFileSelect={(path: string) => {
                setActiveActivity('explorer');
                const folder = path.substring(0, path.lastIndexOf('/')) || '';
                setExplorerPath(folder);
                loadFiles(folder);
                openFileWithConversion(path);
              }}
            />
          </div>
        ) : activeActivity === 'images' ? (
          <ImageGeneratorPanel
            width={leftWidth}
            onImageSelect={(url, path) => {
              // Insert image into active document if one is open
              if (activeTabId && tabs[activeTabId]) {
                const cursorPos = document.querySelector('.tiptap ProseMirror-focused') as HTMLElement | null;
                const insertText = `<img src="${url}" alt="${path}" />`;
                setContent(content + '\n' + insertText);
              }
            }}
            onOpenTranscription={async (text: string) => {
              // Generate a unique filename with timestamp
              const now = new Date();
              const ts = now.getFullYear().toString() +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0') + '_' +
                now.getHours().toString().padStart(2, '0') +
                now.getMinutes().toString().padStart(2, '0') +
                now.getSeconds().toString().padStart(2, '0');
              const fileName = `Transcribed_${ts}`;
              const targetFolder = explorerPath || '';
              const filePath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

              try {
                // Wrap plain text in HTML paragraphs for the editor
                const htmlContent = text.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
                await createFile(filePath, '');
                await updateFile(filePath, htmlContent);
                await openFileWithConversion(filePath);
                loadFiles(targetFolder);
              } catch (err) {
                alert(`Failed to create document: ${err instanceof Error ? err.message : 'Unknown error'}`);
              }
            }}
          />
        ) : activeActivity === 'graph' ? (
          <div style={{ width: leftWidth, minWidth: leftWidth, overflow: 'hidden' }}>
            <RelationshipGraphSidebar
              seedPath={currentPath || null}
              onGenerate={handleGenerate}
              onViewCached={handleViewCached}
              onClear={handleClear}
              loading={graphLoading}
              error={graphError}
              hasCache={graphHasCache}
              mergeMessage={null}
            />
          </div>
        ) : activeActivity === 'outline' ? (
          <BookmarkSidebar
            content={content}
            currentPath={currentPath}
            headings={currentPath ? parseHeadings(content) : []}
            bookmarks={currentPath ? getBookmarks(currentPath) : []}
            onNavigateToHeading={(text: string) => {
              // Scroll to heading text in the editor DOM
              const editorDom = document.querySelector('.editor-main .ProseMirror');
              if (!editorDom) return;
              const headings = Array.from(editorDom.querySelectorAll('h1, h2, h3')) as HTMLElement[];
              const target = headings.find(h => h.textContent?.trim() === text);
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Briefly highlight
                target.style.transition = 'background 0.3s';
                target.style.background = 'hsl(var(--primary) / 0.2)';
                setTimeout(() => { target.style.background = ''; }, 1500);
              }
            }}
            onRemoveBookmark={(bookmarkId: string) => {
              if (currentPath) removeBookmark(currentPath, bookmarkId);
            }}
            width={leftWidth}
          />
        ) : activeActivity === 'dialogue' ? (
          <div style={{ width: leftWidth, minWidth: leftWidth, overflow: 'hidden' }}>
            <DialogueSidebar onOpenDialogue={handleOpenDialogue} />
          </div>
        ) : activeActivity === 'reminders' ? (
          <ReminderSidebar
            width={leftWidth}
            onFileSelect={(path: string) => {
              setActiveActivity('explorer');
              const folder = path.substring(0, path.lastIndexOf('/')) || '';
              setExplorerPath(folder);
              loadFiles(folder);
              openFileWithConversion(path);
            }}
            currentFilePath={currentPath ?? undefined}
          />
        ) : (
          <SearchPanel
            width={leftWidth}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            loading={searchLoading}
            error={searchError}
            onFileOpen={(path: string) => {
              setActiveActivity('explorer');
              const folder = path.substring(0, path.lastIndexOf('/')) || '';
              setExplorerPath(folder);
              loadFiles(folder);
              openFileWithConversion(path);
            }}
          />
        )}
          </>
        )}

        {/* Collapsed Panel Toggle — shows when left panel is hidden */}
        {leftPanelHidden && (
          <button
            className="activity-icon"
            onClick={toggleLeftPanel}
            title="Show Side Panel"
            style={{
              width: '24px',
              minWidth: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'rgb(var(--card) / 0.9)',
              border: 'none',
              borderRadius: '4px',
              padding: '6px',
              margin: '4px',
              color: 'rgb(var(--fg))',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          </button>
        )}

        {/* Resizer — only shown when left panel is visible */}
        {!leftPanelHidden && (
          <div
            className="resizer"
            onMouseDown={resizeLeftPanel}
          />
        )}

        {/* Center Panel - Tabbed Editor */}
        <div className="flex flex-col min-w-[300px] flex-1">
          {/* Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitch={handleTabSwitch}
            onClose={handleTabClose}
            onCloseOthers={handleTabCloseOthers}
            onCloseAll={handleTabCloseAll}
            onConfirmDirtyClose={handleConfirmDirtyClose}
            dirtyTabIdsRef={dirtyTabIdsRef}
          />

          {/* Document Editor or Welcome Screen */}
          {!activeTabId ? (
            <Welcome
              recentFiles={recentFiles}
              starredFiles={starredFiles}
              onFileClick={(path) => {
                const folder = path.substring(0, path.lastIndexOf('/')) || '';
                setExplorerPath(folder);
                loadFiles(folder);
                openFileWithConversion(path);
              }}
              onRemoveRecent={removeRecent}
              onToggleStar={toggleStar}
              onNewFile={handleCreateFileFromEditor}
              onCreateFromTemplate={() => setShowTemplateModal(true)}
              onGenerateWithAI={aiOffline ? undefined : (() => setShowGenerateModal(true))}
              aiOffline={aiOffline}
              onOpenHelp={() => setShowHelp(true)}
            />
          ) : (
            <DocumentEditor
              content={content}
              currentPath={currentPath}
              loading={loading}
              dirty={dirty}
              canRestore={canRestore}
              originalContent={activeTabId ? tabs[activeTabId]?.originalContent || '' : ''}
              onChange={setContent}
              onSave={handleSave}
              onRestore={handleRestore}
              onCreateFile={handleCreateFileFromEditor}
              onCreateFromTemplate={() => setShowTemplateModal(true)}
              onDownload={handleDownload}
              onExportPDF={handleExportPDF}
              onExportDOCX={handleExportDOCX}
              imageToInsert={imageToInsert}
              onImageInserted={() => setImageToInsert(null)}
              onOpenTagSidebar={handleOpenTagSidebar}
              onOpenFile={(filePath) => openFileWithConversion(filePath)}
              onCreateNamedFile={(name) => newFile(explorerPath, name)}
                onOpenGraph={handleOpenGraph}
                username={user?.username}
              />
          )}
        </div>

        {showAISidebar && (
          <>
            {/* Resizer */}
            <div
              className="resizer"
              onMouseDown={resizeRightPanel}
            />

            {/* Right Panel - AI Chat */}
            <ChatPanel
              history={chatHistory}
              loading={llmLoading}
              onSend={async (msg: string, docContent: string) => {
              const response = await sendMessage(msg, docContent);
              // After LLM response, reload tabs for files that were modified by tools
              if (response?.toolActivity) {
                for (const ta of response.toolActivity) {
                  if (ta.status === 'complete' && ['write', 'edit', 'rename', 'move'].includes(ta.tool)) {
                    const filePath = ta.args?.file_path || ta.args?.path || ta.args?.new_path || ta.args?.dest_path;
                    if (filePath) {
                      // Find the tab ID for this file path
                      const tabId = Object.values(tabs).find(t => t.path === filePath)?.id;
                      if (tabId) {
                        reloadTab(tabId);
                      }
                    }
                  }
                }
              }
              return response;
            }}
              onClear={clearChat}
              documentContent={content}
              width={rightWidth}
              toolsEnabled={toolsEnabled}
              onToggleTools={() => setToolsEnabled(!toolsEnabled)}
              aiOffline={aiOffline}
              messagesTrimmed={messagesTrimmed}
              onDismissTrimNotification={dismissTrimNotification}
            />
          </>
        )}
      </div>

      <StatusBar
        currentPath={currentPath}
        wordCount={wordCount}
        llmConnected={llmConnected}
        error={error}
        aiOffline={aiOffline}
      />

      {/* New from Template Modal */}
      {showTemplateModal && (
        <NewFromTemplateModal
          defaultFolder={explorerPath}
          onClose={() => setShowTemplateModal(false)}
          onSuccess={handleTemplateSuccess}
        />
      )}

      {/* Compile Story Bible Modal */}
      {showCompileModal && (
        <CompileStoryBibleModal
          selectedFiles={files}
          currentFolder={explorerPath}
          allFiles={files}
          onClose={() => setShowCompileModal(false)}
          onSuccess={handleCompileSuccess}
        />
      )}

      {/* Generate Document with AI Modal */}
      {showGenerateModal && (
        <GenerateDocumentModal
          onClose={() => setShowGenerateModal(false)}
          onFileCreated={(path: string) => {
            setShowGenerateModal(false);
            openFileWithConversion(path);
          }}
        />
      )}

      {/* Game Export Modal */}
      {showGameExportModal && (
        <GameExportModal
          currentPath={currentPath || null}
          content={content}
          onClose={() => setShowGameExportModal(false)}
          onFileCreated={(path: string) => {
            setShowGameExportModal(false);
            openFileWithConversion(path);
          }}
          aiOffline={aiOffline}
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
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmSecondaryLabel('');
          setConfirmSecondaryCallback(null);
          confirmCallbackRef.current = null;
          confirmSecondaryCallbackRef.current = null;
          if ((window as any).__confirmCancelHandler) {
            (window as any).__confirmCancelHandler();
            delete (window as any).__confirmCancelHandler;
          }
        }}
        onConfirm={() => {
          const cb = confirmCallbackRef.current;
          const legacyCb = confirmCallback;
          setConfirmOpen(false);
          setConfirmSecondaryLabel('');
          setConfirmSecondaryCallback(null);
          confirmCallbackRef.current = null;
          confirmSecondaryCallbackRef.current = null;
          // Use ref for dirty-tab callbacks, fall back to state for legacy callers
          if (cb) {
            cb();
          } else if (legacyCb) {
            legacyCb();
          }
          delete (window as any).__confirmCancelHandler;
        }}
        onSecondary={() => {
          const cb = confirmSecondaryCallbackRef.current || confirmSecondaryCallback;
          if (!cb) return;
          setConfirmOpen(false);
          setConfirmSecondaryLabel('');
          setConfirmSecondaryCallback(null);
          confirmCallbackRef.current = null;
          confirmSecondaryCallbackRef.current = null;
          cb();
        }}
      />

      {/* Graph Modal */}
      {graphModalData && (
        <GraphModal
          nodes={graphModalData.nodes}
          edges={graphModalData.edges}
          model={graphModalData.model}
          onClose={handleCloseModal}
          onNodeClick={(nodeId: string) => {
            const folder = nodeId.substring(0, nodeId.lastIndexOf('/')) || '';
            setExplorerPath(folder);
            loadFiles(folder);
            openFileWithConversion(nodeId);
          }}
        />
      )}

      {/* Conversation Designer (replaces old DialogueEditorModal) */}
      {dialogueScene && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={handleCloseDialogue}
        >
          <div
            className="bg-[#1e1e2e] rounded-xl shadow-2xl border border-[#3a3a4a] w-[92vw] h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <SceneConversationDesigner
              sceneId={dialogueScene.id}
              sceneName={dialogueScene.name}
              onClose={handleCloseDialogue}
            />
          </div>
        </div>
      )}

      {/* Help Panel */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowHelp(false)}>
          <div
            className="bg-[#1e1e2e] rounded-lg shadow-2xl border border-[#3a3a4a] w-[85vw] max-w-4xl h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <HelpPanel onClose={() => setShowHelp(false)} />
          </div>
        </div>
      )}

      {/*
Custom Prompt Dialog (replaces prompt) */}
      <PromptDialog
        open={promptOpen}
        title={promptTitle}
        message={promptMessage}
        defaultValue={promptDefault}
        placeholder={promptPlaceholder}
        confirmLabel={promptConfirmLabel}
        onCancel={() => {
          setPromptOpen(false);
          if (promptCallback) {
            promptCallback(null as any);
            setPromptCallback(null);
          }
        }}
        onConfirm={(value) => {
          setPromptOpen(false);
          if (promptCallback) {
            promptCallback(value);
            setPromptCallback(null);
          }
        }}
      />

      {/* Folder Picker Dialog (replaces prompt for folder selection) */}
      <FolderPickerDialog
        open={folderPickerOpen}
        defaultFolder={folderPickerDefault}
        message="Select a destination folder for the move."
        onCancel={() => {
          setFolderPickerOpen(false);
          if (folderPickerCallback) {
            folderPickerCallback(null as any);
            setFolderPickerCallback(null);
          }
        }}
        onConfirm={(folderPath) => {
          setFolderPickerOpen(false);
          if (folderPickerCallback) {
            folderPickerCallback(folderPath);
            setFolderPickerCallback(null);
          }
        }}
      />

      {/* Profile Selector Modal - shown for new users */}
      {isNewUser && (
        <ProfileSelectorModal
          onClose={() => clearNewUserFlag()}
          onSelect={(profile) => {
            clearNewUserFlag();
            // Refresh file list after profile selection
            loadFiles('');
          }}
        />
      )}

      {/* Maintenance Modal */}
      <MaintenanceModal show={showMaintenance} onClose={() => setShowMaintenance(false)} />
    </div>
  );
}
