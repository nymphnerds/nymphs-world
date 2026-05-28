import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { ImageResize } from '../extensions/resize-image';
import { Spellcheck, MisspelledMark, runSpellcheck, clearSpellcheckMarks } from '../extensions/spellcheck';
import { WikiLink, wikiLinkRegex, parseWikiLinkText } from '../extensions/wiki-link';
import { InformationPanel } from './InformationPanel';
import { WikiLinkPopover } from './WikiLinkPopover';
import { WikiLinkAutocomplete } from './WikiLinkAutocomplete';
import { EmojiPicker } from './EmojiPicker';
import { sendCompletion, resolveWikiLink, searchWikiLinks } from '../services/api';
import {
  Save, FilePlus, Download, FileText, FileSpreadsheet,
  Bold, Italic, Underline as UnderlineIcon, Undo2, Redo2,
  List, ListOrdered,
  Table as TableIcon,
  CheckCheck,
  Search, Replace, X, ChevronLeft, ChevronRight, ChevronDown,
  Sparkles, Loader2, RotateCcw, Smile,
} from 'lucide-react';

interface DocumentEditorProps {
  content: string;
  currentPath: string | null;
  loading: boolean;
  dirty: boolean;
  canRestore: boolean;
  originalContent: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onRestore: () => void;
  onCreateFile: () => void;
  onCreateFromTemplate?: () => void;
  onDownload: () => void;
  onExportPDF: () => void;
  onExportDOCX: () => void;
  imageToInsert: { src: string; alt: string } | null;
  onImageInserted: () => void;
  onOpenTagSidebar?: () => void;
  onOpenFile?: (filePath: string) => void;
  onCreateNamedFile?: (name: string) => void;
  onOpenGraph?: () => void;
  username?: string | null;
}

const SPLIT_DELIMITER = '<!-- MARGIN_SPLIT -->';

// Parse combined content into main + information parts
function parseContent(html: string): { main: string; info: string } {
  if (html.includes(SPLIT_DELIMITER)) {
    const parts = html.split(SPLIT_DELIMITER);
    return { main: parts[0] || '', info: parts[1] || '' };
  }
  // Legacy content — everything goes to main
  return { main: html, info: '' };
}

// Combine main + information into single saveable HTML
function combineContent(main: string, info: string): string {
  if (info.trim()) {
    return main + SPLIT_DELIMITER + info;
  }
  return main;
}

// --- Search Highlight Mark ---
// Reuses MisspelledMark styling approach: we apply a custom class via setMeta
// We track search state manually rather than a TipTap extension for simplicity

export function DocumentEditor({
  content,
  currentPath,
  loading,
  dirty,
  canRestore,
  originalContent,
  onChange,
  onSave,
  onRestore,
  onCreateFile,
  onCreateFromTemplate,
  onDownload,
  onExportPDF,
  onExportDOCX,
  imageToInsert,
  onImageInserted,
  onOpenTagSidebar,
  onOpenFile,
  onCreateNamedFile,
  onOpenGraph,
  username,
}: DocumentEditorProps) {
  const prevPathRef = useRef<string | null>(null);
  const prevContentRef = useRef<string>('');
  const syncRef = useRef(true);
  const isUserChangeRef = useRef(false);
  // Keep onChange in a ref so TipTap's onUpdate (which has no dep array) always
  // calls the latest callback instead of a stale closure
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [splitPercent, setSplitPercent] = useState(66);
  const [spellcheckCount, setSpellcheckCount] = useState<number | null>(null);
  const [spellchecking, setSpellchecking] = useState(false);

  // --- WikiLink Popover State ---
  const [showWikiLinkPopover, setShowWikiLinkPopover] = useState(false);
  const [wikiLinkTarget, setWikiLinkTarget] = useState('');
  const [wikiLinkAnchorRect, setWikiLinkAnchorRect] = useState<DOMRect | null>(null);

  // --- Ghost Text (AI Completion) State ---
  const [ghostText, setGhostText] = useState('');
  const [ghostTextLoading, setGhostTextLoading] = useState(false);
  const [autoGhost, setAutoGhost] = useState(false);
  const ghostPositionRef = useRef(0);
  const completionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const autoGhostDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // --- Emoji Picker State ---
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiAnchorRect, setEmojiAnchorRect] = useState<DOMRect | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);

  // --- Find & Replace State ---
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');

  // --- New File Dropdown State ---
  const [newFileMenuOpen, setNewFileMenuOpen] = useState(false);
  const newFileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!newFileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (newFileMenuRef.current && !newFileMenuRef.current.contains(e.target as Node)) {
        setNewFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [newFileMenuOpen]);
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const findTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Ghost Text TipTap Extension ---
  const GhostTextExtension = useMemo(
    () => Extension.create({
      name: 'ghostText',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            key: new PluginKey('ghostText'),
            state: {
              init() {
                return DecorationSet.empty;
              },
              apply(tr, set) {
                // Remove ghost text on any transaction that changes content
                if (tr.docChanged) return DecorationSet.empty;
                return set.map(tr.mapping, tr.doc);
              },
            },
            props: {
              decorations(state) {
                const decos = this.getState(state);
                if (!ghostText || decos !== DecorationSet.empty) return decos;

                // Find cursor position
                const { selection } = state;
                const pos = selection.from;

                // Create ghost text widget at cursor position
                const widget = document.createElement('span');
                widget.className = 'ghost-text-suggestion';
                widget.textContent = ghostText;
                widget.setAttribute('contenteditable', 'false');

                return DecorationSet.create(state.doc, [
                  Decoration.widget(pos, widget, {
                    side: 1,
                  }),
                ]);
              },
            },
          }),
        ];
      },
    }),
    [ghostText]
  );

  // --- Main Editor ---
  const mainEditor = useEditor({
    editorProps: {
      attributes: { spellcheck: 'true', lang: 'en' },
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      MisspelledMark,
      Spellcheck,
      WikiLink.configure({
        onLinkClick: (targetName: string, exists: boolean, filePath: string | null) => {
          if (exists && filePath) {
            onOpenFile?.(filePath);
          } else if (!exists) {
            onCreateNamedFile?.(targetName);
          }
        },
        onHover: (targetName: string, _exists: boolean, _filePath: string | null, element: HTMLElement) => {
          setWikiLinkTarget(targetName);
          setWikiLinkAnchorRect(element.getBoundingClientRect());
          setShowWikiLinkPopover(true);
        },
      }),
      ImageResize.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      GhostTextExtension,
    ],
    content: '',
    onCreate: ({ editor: ed }) => {
      (ed.view.dom as HTMLElement).addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'IMG') {
          e.preventDefault();
          target.classList.toggle('reduced');
          ed.commands.focus();
        }
      });
    },
    onUpdate: ({ editor: ed }) => {
      if (!syncRef.current) return;
      isUserChangeRef.current = true;
      const infoHtml = marginEditor ? marginEditor.getHTML() : '';
      onChangeRef.current(combineContent(ed.getHTML(), infoHtml));
    },
  });

  // --- Information Editor ---
  const marginEditor = useEditor({
    editorProps: {
      attributes: { spellcheck: 'true', lang: 'en' },
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      MisspelledMark,
      Spellcheck,
      WikiLink.configure({
        onLinkClick: (targetName: string, exists: boolean, filePath: string | null) => {
          if (exists && filePath) {
            onOpenFile?.(filePath);
          } else if (!exists) {
            onCreateNamedFile?.(targetName);
          }
        },
        onHover: (targetName: string, _exists: boolean, _filePath: string | null, element: HTMLElement) => {
          setWikiLinkTarget(targetName);
          setWikiLinkAnchorRect(element.getBoundingClientRect());
          setShowWikiLinkPopover(true);
        },
      }),
      ImageResize.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: 'Notes, images, references...',
      }),
    ],
    content: '',
    onUpdate: ({ editor: ed }) => {
      if (!syncRef.current) return;
      isUserChangeRef.current = true;
      const mainHtml = mainEditor ? mainEditor.getHTML() : '';
      onChangeRef.current(combineContent(mainHtml, ed.getHTML()));
    },
  });

  // Sync external content to editors
  useEffect(() => {
    if (!mainEditor || !marginEditor || !currentPath) return;

    // File changed — always sync
    if (prevPathRef.current !== currentPath) {
      syncRef.current = false;
      const { main, info } = parseContent(content || '');
      mainEditor.commands.setContent(main);
      marginEditor.commands.setContent(info);
      clearSpellcheckMarks(mainEditor);
      clearSpellcheckMarks(marginEditor);
      setSpellcheckCount(null);
      syncRef.current = true;
      prevPathRef.current = currentPath;
      prevContentRef.current = content || '';
      isUserChangeRef.current = false;
      return;
    }

    // Same file — only sync if content changed externally
    if (content !== prevContentRef.current && !isUserChangeRef.current) {
      syncRef.current = false;
      const { main, info } = parseContent(content || '');
      mainEditor.commands.setContent(main);
      marginEditor.commands.setContent(info);
      syncRef.current = true;
      prevContentRef.current = content;
      isUserChangeRef.current = false;
    }
  }, [currentPath, content, mainEditor, marginEditor]);

  // Insert image at cursor position in information editor (from file explorer)
  useEffect(() => {
    if (imageToInsert && marginEditor) {
      marginEditor.commands.setImage({ src: imageToInsert.src, alt: imageToInsert.alt });
      onImageInserted();
    }
  }, [imageToInsert, marginEditor, onImageInserted]);

  // --- Find & Replace Logic ---
  const clearSearchHighlights = useCallback(() => {
    if (mainEditor) {
      const dom = mainEditor.view.dom as HTMLElement;
      const marks = dom.querySelectorAll('.search-highlight');
      marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
          parent.normalize();
        }
      });
      mainEditor.view.updateState(mainEditor.state);
    }
  }, [mainEditor]);

  const performSearch = useCallback(() => {
    if (!mainEditor || !findText) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    clearSearchHighlights();

    const dom = mainEditor.view.dom as HTMLElement;
    const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    const flags = caseSensitive ? 'g' : 'gi';
    let regex;
    try {
      regex = new RegExp(escapeRegex(findText), flags);
    } catch {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    let count = 0;
    textNodes.forEach((node) => {
      const text = node.textContent || '';
      if (regex.test(text)) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
          }
          const span = document.createElement('span');
          span.className = 'search-highlight';
          span.textContent = match[0];
          fragment.appendChild(span);
          lastIndex = regex.lastIndex;
          count++;
        }
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        node.parentNode?.replaceChild(fragment, node);
      }
      regex.lastIndex = 0;
    });

    setMatchCount(count);
    setCurrentMatch(1);

    // Scroll to first match
    if (count > 0) {
      const firstMark = dom.querySelector('.search-highlight');
      firstMark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    mainEditor.view.updateState(mainEditor.state);
  }, [mainEditor, findText, caseSensitive, clearSearchHighlights]);

  // Debounced search on text change
  useEffect(() => {
    if (!showFindReplace) return;
    if (findTimeoutRef.current) clearTimeout(findTimeoutRef.current);
    if (findText) {
      findTimeoutRef.current = setTimeout(performSearch, 200);
    } else {
      clearSearchHighlights();
      setMatchCount(0);
      setCurrentMatch(0);
    }
    return () => {
      if (findTimeoutRef.current) clearTimeout(findTimeoutRef.current);
    };
  }, [findText, caseSensitive, showFindReplace, performSearch, clearSearchHighlights]);

  const navigateMatch = useCallback((direction: 'next' | 'prev') => {
    if (!mainEditor || matchCount === 0) return;
    const dom = mainEditor.view.dom as HTMLElement;
    const marks = Array.from(dom.querySelectorAll('.search-highlight'));
    if (marks.length === 0) return;

    // Find currently focused mark
    let activeIdx = 0;
    marks.forEach((mark, idx) => {
      if (mark.classList.contains('search-highlight-active')) {
        activeIdx = idx;
      }
    });

    // Remove active class from current
    marks[activeIdx]?.classList.remove('search-highlight-active');

    if (direction === 'next') {
      setCurrentMatch((m) => {
        const next = (m % marks.length) + 1;
        return next > marks.length ? 1 : next;
      });
      const nextIdx = currentMatch % marks.length;
      marks[nextIdx]?.classList.add('search-highlight-active');
      marks[nextIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setCurrentMatch((m) => {
        const prev = m - 2 < 0 ? marks.length : m - 1;
        return prev < 1 ? marks.length : prev;
      });
      const prevIdx = (currentMatch - 2 + marks.length) % marks.length;
      marks[prevIdx]?.classList.add('search-highlight-active');
      marks[prevIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [mainEditor, matchCount, currentMatch]);

  const handleReplace = useCallback(() => {
    if (!mainEditor || !findText || matchCount === 0) return;
    const dom = mainEditor.view.dom as HTMLElement;
    const activeMark = dom.querySelector('.search-highlight-active');
    if (activeMark) {
      // Replace the active match in the DOM, then let TipTap sync via onUpdate
      const parent = activeMark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(replaceText), activeMark);
        parent.normalize();
      }
      // Re-search after replace
      setTimeout(performSearch, 50);
    }
  }, [mainEditor, findText, replaceText, matchCount, performSearch]);

  const handleReplaceAll = useCallback(() => {
    if (!mainEditor || !findText) return;

    const flags = caseSensitive ? 'g' : 'gi';
    let regex;
    try {
      regex = new RegExp(escapeRegex(findText), flags);
    } catch {
      return;
    }

    // Get plain text, replace, and re-set
    const html = mainEditor.getHTML();
    // Strip HTML tags for text-only replacement approach won't work well
    // Instead, walk DOM and replace all highlights
    const dom = mainEditor.view.dom as HTMLElement;
    const marks = dom.querySelectorAll('.search-highlight');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(replaceText), mark);
        parent.normalize();
      }
    });
    mainEditor.view.updateState(mainEditor.state);
    clearSearchHighlights();
    setMatchCount(0);
    setCurrentMatch(0);
  }, [mainEditor, findText, replaceText, caseSensitive, clearSearchHighlights]);

  const closeFindReplace = useCallback(() => {
    setShowFindReplace(false);
    clearSearchHighlights();
    setMatchCount(0);
    setCurrentMatch(0);
    setFindText('');
    setReplaceText('');
  }, [clearSearchHighlights]);

  // Keyboard shortcut: Ctrl+F / Ctrl+H
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFindReplace((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowFindReplace(true);
      }
      // Escape to close
      if (e.key === 'Escape' && showFindReplace) {
        closeFindReplace();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showFindReplace, closeFindReplace]);

  const fileName = currentPath ? (currentPath.split('/').pop() || '').replace(/\.html$/i, '') : '';

  // --- AI Completion Handler ---
  const handleAIDecline = useCallback(() => {
    setGhostText('');
  }, []);

  const handleAIComplete = useCallback(() => {
    if (!ghostText || !mainEditor) return;
    // Clear ghost text and accept the suggestion
    // We need to insert the ghost text at the cursor position
    const pos = mainEditor.state.selection.from;
    // Strip HTML tags for plain text insertion
    const temp = document.createElement('div');
    temp.innerHTML = `<p>${ghostText}</p>`;
    const plainText = temp.textContent || ghostText;
    mainEditor.commands.insertContentAt(pos, `<span>${plainText}</span>`);
    setGhostText('');
  }, [ghostText, mainEditor]);

  const handleAICompleteAtCursor = useCallback(async () => {
    if (!mainEditor || !currentPath || ghostTextLoading) return;

    const pos = mainEditor.state.selection.from;
    ghostPositionRef.current = pos;

    // Get surrounding text context (text before cursor)
    const node = mainEditor.view.nodeDOM(pos);
    const nodeText = node?.textContent || '';

    // Get full document text as context
    const docText = mainEditor.state.doc.textContent || '';

    // Get ~500 words before cursor for context
    const textBefore = docText.slice(0, pos);
    const contextStart = Math.max(0, textBefore.lastIndexOf(' ', textBefore.length - 300));
    const context = textBefore.slice(contextStart);

    if (!context.trim()) return;

    setGhostTextLoading(true);
    setGhostText('');

    try {
      const fileName = currentPath.split('/').pop() || '';
      const result = await sendCompletion(context, fileName, 200);

      if (result.completion && result.completion.trim()) {
        // Only show if cursor hasn't moved
        if (mainEditor.state.selection.from === ghostPositionRef.current) {
          setGhostText(result.completion.trim());
        }
      }
    } catch (err) {
      console.error('AI completion error:', err);
    } finally {
      setGhostTextLoading(false);
    }
  }, [mainEditor, currentPath, ghostTextLoading]);

  // Auto-ghost: when enabled, automatically trigger completion on editor idle
  useEffect(() => {
    if (!autoGhost || !mainEditor || !currentPath || ghostTextLoading || ghostText) return;
    if (autoGhostDebounceRef.current) clearTimeout(autoGhostDebounceRef.current);

    autoGhostDebounceRef.current = setTimeout(() => {
      // Only trigger if there's enough context and no existing ghost text
      const pos = mainEditor.state.selection.from;
      const docText = mainEditor.state.doc.textContent || '';
      const textBefore = docText.slice(0, pos);
      const contextStart = Math.max(0, textBefore.lastIndexOf(' ', textBefore.length - 300));
      const context = textBefore.slice(contextStart);

      // Need at least 50 chars of context, and must end with whitespace (mid-sentence)
      if (context.trim().length >= 50 && /\s$/.test(context)) {
        ghostPositionRef.current = pos;
        setGhostTextLoading(true);
        setGhostText('');

        sendCompletion(context, currentPath.split('/').pop() || '', 200)
          .then((result) => {
            if (result.completion && result.completion.trim()) {
              if (mainEditor.state.selection.from === pos) {
                setGhostText(result.completion.trim());
              }
            }
          })
          .catch((err) => console.error('Auto-ghost error:', err))
          .finally(() => setGhostTextLoading(false));
      }
    }, 1500); // 1.5s idle debounce

    return () => {
      if (autoGhostDebounceRef.current) clearTimeout(autoGhostDebounceRef.current);
    };
  }, [autoGhost, mainEditor, currentPath, ghostTextLoading, ghostText]);

  // Keyboard shortcuts for AI: Ctrl+Space to complete, Tab to accept, Escape to decline
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Space to trigger AI completion
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
        e.preventDefault();
        handleAICompleteAtCursor();
      }
      // Tab to accept ghost text (only when not in find/replace)
      if (e.key === 'Tab' && ghostText && !showFindReplace) {
        e.preventDefault();
        handleAIComplete();
      }
      // Escape to decline ghost text
      if (e.key === 'Escape' && ghostText && !showFindReplace) {
        e.preventDefault();
        handleAIDecline();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [ghostText, showFindReplace, handleAIComplete, handleAIDecline, handleAICompleteAtCursor]);

  // Check spelling handler
  const handleCheckSpelling = useCallback(async () => {
    if (!mainEditor || !marginEditor || spellchecking) return;
    setSpellchecking(true);
    try {
      const [mainCount, infoCount] = await Promise.all([
        runSpellcheck(mainEditor),
        runSpellcheck(marginEditor),
      ]);
      setSpellcheckCount(mainCount + infoCount);
    } catch (err) {
      console.error('Spellcheck error:', err);
    } finally {
      setSpellchecking(false);
    }
  }, [mainEditor, marginEditor, spellchecking]);

  // Insert emoji at cursor
  const insertEmoji = useCallback((emoji: string) => {
    if (mainEditor) {
      mainEditor.commands.insertContent(emoji);
      setShowEmojiPicker(false);
    }
  }, [mainEditor]);

  // Toolbar button group component to avoid duplication
  const renderToolbar = (ed: any, showHeadings: boolean) => (
    <>
      <button
        onClick={() => ed.commands.undo()}
        disabled={!ed.can().undo()}
        className={`p-1 rounded transition-colors disabled:opacity-30 ${!ed.can().undo() ? 'cursor-not-allowed' : 'hover:bg-accent text-muted-foreground'}`}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={14} />
      </button>
      <button
        onClick={() => ed.commands.redo()}
        disabled={!ed.can().redo()}
        className={`p-1 rounded transition-colors disabled:opacity-30 ${!ed.can().redo() ? 'cursor-not-allowed' : 'hover:bg-accent text-muted-foreground'}`}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={14} />
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      <button
        onClick={() => ed.commands.toggleBold()}
        className={`p-1 rounded transition-colors ${ed.isActive('bold') ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
        title="Bold (Ctrl+B)"
      >
        <Bold size={14} />
      </button>
      <button
        onClick={() => ed.commands.toggleItalic()}
        className={`p-1 rounded transition-colors ${ed.isActive('italic') ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
        title="Italic (Ctrl+I)"
      >
        <Italic size={14} />
      </button>
      <button
        onClick={() => ed.commands.toggleUnderline()}
        className={`p-1 rounded transition-colors ${ed.isActive('underline') ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
        title="Underline"
      >
        <UnderlineIcon size={14} />
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {showHeadings && (
        <>
          <button
            onClick={() => ed.commands.toggleHeading({ level: 1 })}
            className={`p-1 rounded transition-colors text-xs font-bold ${ed.isActive('heading', { level: 1 }) ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => ed.commands.toggleHeading({ level: 2 })}
            className={`p-1 rounded transition-colors text-xs font-bold ${ed.isActive('heading', { level: 2 }) ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => ed.commands.toggleHeading({ level: 3 })}
            className={`p-1 rounded transition-colors text-xs font-bold ${ed.isActive('heading', { level: 3 }) ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
            title="Heading 3"
          >
            H3
          </button>

          <div className="w-px h-4 bg-border mx-0.5" />
        </>
      )}

      <button
        onClick={() => ed.commands.toggleBulletList()}
        className={`p-1 rounded transition-colors ${ed.isActive('bulletList') ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
        title="Bullet List"
      >
        <List size={14} />
      </button>
      <button
        onClick={() => ed.commands.toggleOrderedList()}
        className={`p-1 rounded transition-colors ${ed.isActive('orderedList') ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
        title="Numbered List"
      >
        <ListOrdered size={14} />
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      <button
        onClick={() => ed.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })}
        className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
        title="Insert Table"
      >
        <TableIcon size={14} />
      </button>

      <div className="w-px h-4 bg-border mx-0.5" />

      <button
        ref={emojiButtonRef}
        onClick={() => {
          if (showEmojiPicker) {
            setShowEmojiPicker(false);
          } else {
            const rect = emojiButtonRef.current?.getBoundingClientRect?.();
            if (rect) setEmojiAnchorRect(rect);
            setShowEmojiPicker(true);
          }
        }}
        className={`p-1 rounded transition-colors ${showEmojiPicker ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
        title="Insert Emoji"
      >
        <Smile size={14} />
      </button>
    </>
  );

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* File Name Bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-secondary/30">
        <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={fileName || '(No file open)'}>
          {fileName || '(No file open)'}
        </span>
      </div>

      {/* Editor Area - Two Column with Draggable Split */}
      <div className="flex flex-1 overflow-hidden">
        {currentPath && mainEditor && marginEditor ? (
          <>
            {/* Main Editor (Left) */}
            <div className="flex flex-col overflow-hidden" style={{ width: `${splitPercent}%`, minWidth: 0 }}>
               {/* Row 1: Editor Formatting Bar */}
               <div className="flex items-center gap-0.5 px-2 py-0.5 border-b border-border/30 bg-secondary/20">
                 <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-1.5 font-semibold">Editor</span>
                 <div className="w-px h-4 bg-border mx-0.5" />
                 {renderToolbar(mainEditor, true)}
               </div>

               {/* Row 2: File Operations Bar */}
               <div className="flex items-center gap-0.5 px-2 py-0.5 border-b border-border/50 bg-secondary/20">
                 {/* Left: File Operations */}
                 <button
                   onClick={onSave}
                   disabled={!currentPath || loading}
                   className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50 transition-colors ${dirty ? 'save-btn-dirty' : ''}`}
                   title="Save (Ctrl+S)"
                 >
                   <Save size={12} />
                   Save
                 </button>

                 {/* New File Dropdown */}
                 <div ref={newFileMenuRef} className="relative">
                   <button
                     onClick={() => setNewFileMenuOpen(!newFileMenuOpen)}
                     className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
                     title="Create new file"
                   >
                     <FilePlus size={14} />
                   </button>
                   {newFileMenuOpen && (
                     <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] bg-[#1e1e2e] border border-border rounded-lg shadow-xl py-1">
                       <button
                         onClick={() => { setNewFileMenuOpen(false); onCreateFile(); }}
                         className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-accent hover:text-white transition-colors"
                       >
                         New Blank File
                       </button>
                       {onCreateFromTemplate && (
                         <button
                           onClick={() => { setNewFileMenuOpen(false); onCreateFromTemplate(); }}
                           className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-accent hover:text-white transition-colors"
                         >
                           New from Template...
                         </button>
                       )}
                     </div>
                   )}
                 </div>

                 <button
                   onClick={() => {
                     if (!canRestore || !confirm('Restore file to last saved version? All changes since opening this file will be lost.')) return;
                     if (mainEditor && marginEditor) {
                       syncRef.current = false;
                       const { main, info } = parseContent(originalContent);
                       mainEditor.commands.setContent(main);
                       marginEditor.commands.setContent(info);
                       syncRef.current = true;
                     }
                     onRestore();
                   }}
                   disabled={!canRestore}
                   className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 transition-colors"
                   title="Restore to last opened version"
                 >
                   <RotateCcw size={14} />
                 </button>

                 <div className="w-px h-4 bg-border mx-0.5" />

                 <button
                   onClick={onDownload}
                   disabled={!currentPath || loading}
                   className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-50 transition-colors"
                   title="Download as HTML"
                 >
                   <Download size={14} />
                 </button>

                 <button
                   onClick={onExportPDF}
                   disabled={!currentPath || loading}
                   className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-50 transition-colors"
                   title="Export as PDF"
                 >
                   <FileText size={14} />
                 </button>

                 <button
                   onClick={onExportDOCX}
                   disabled={!currentPath || loading}
                   className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-50 transition-colors"
                   title="Export as DOCX"
                 >
                   <FileSpreadsheet size={14} />
                 </button>

                  {/* Right: Utility Actions */}
                  <div className="ml-auto flex items-center gap-0.5">
                    <button
                     onClick={() => setShowFindReplace((prev) => !prev)}
                     className={`p-1 rounded transition-colors ${showFindReplace ? 'bg-primary/30 text-primary' : 'hover:bg-accent text-muted-foreground'}`}
                     title="Find & Replace (Ctrl+F)"
                   >
                     <Search size={14} />
                   </button>
                   {/* AI Complete Button */}
                   <button
                     onClick={handleAICompleteAtCursor}
                     disabled={!currentPath || ghostTextLoading}
                     className={`p-1 rounded transition-colors disabled:opacity-50 ${
                       ghostTextLoading
                         ? 'text-amber-400 hover:bg-amber-400/10'
                         : 'text-muted-foreground hover:bg-accent'
                     }`}
                     title="AI Complete (Ctrl+Space)"
                   >
                     {ghostTextLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                   </button>
                   {/* Auto-Ghost Toggle */}
                   <button
                     onClick={() => { setAutoGhost((p) => !p); setGhostText(''); }}
                     disabled={!currentPath}
                     className={`p-1 rounded transition-colors disabled:opacity-50 ${
                       autoGhost
                         ? 'bg-primary/30 text-primary'
                         : 'text-muted-foreground hover:bg-accent'
                     }`}
                     title={autoGhost ? 'Auto-complete ON (click to disable)' : 'Auto-complete OFF (click to enable)'}
                   >
                     <span className="text-[10px] font-bold leading-none">AI</span>
                   </button>
                   {ghostText && (
                     <span className="text-[10px] px-1 text-primary">
                       Tab to accept, Esc to dismiss
                     </span>
                   )}
                   <button
                     onClick={handleCheckSpelling}
                     disabled={!currentPath || spellchecking}
                     className={`p-1 rounded transition-colors disabled:opacity-50 ${
                       spellcheckCount !== null && spellcheckCount > 0
                         ? 'text-amber-400 hover:bg-amber-400/10'
                         : spellcheckCount === 0
                           ? 'text-green-400 hover:bg-green-400/10'
                           : 'text-muted-foreground hover:bg-accent'
                     }`}
                     title="Check Spelling"
                   >
                     <CheckCheck size={14} />
                   </button>
                   {spellcheckCount !== null && (
                     <span className={`text-[10px] px-1 font-medium ${
                       spellcheckCount > 0 ? 'text-amber-400' : 'text-green-400'
                     }`}>
                       {spellcheckCount > 0 ? `${spellcheckCount} errors` : 'Clean'}
                     </span>
                   )}
                 </div>
               </div>

              {/* Find & Replace Panel */}
              {showFindReplace && (
                <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-border bg-secondary/30">
                  <div className="flex items-center gap-1.5">
                    <Search size={14} className="text-muted-foreground" />
                    <input
                      type="text"
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      placeholder="Find..."
                      className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded outline-none focus:border-primary text-foreground"
                      autoFocus
                    />
                    <span className="text-[11px] text-muted-foreground min-w-[60px] text-right">
                      {matchCount > 0 ? `${currentMatch} of ${matchCount}` : 'No matches'}
                    </span>
                    <button
                      onClick={() => navigateMatch('prev')}
                      disabled={matchCount === 0}
                      className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 transition-colors"
                      title="Previous match"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => navigateMatch('next')}
                      disabled={matchCount === 0}
                      className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 transition-colors"
                      title="Next match"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={caseSensitive}
                        onChange={(e) => setCaseSensitive(e.target.checked)}
                        className="rounded"
                      />
                      Aa
                    </label>
                    <button
                      onClick={closeFindReplace}
                      className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Replace size={14} className="text-muted-foreground" />
                    <input
                      type="text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      placeholder="Replace..."
                      className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded outline-none focus:border-primary text-foreground"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleReplace();
                        }
                      }}
                    />
                    <button
                      onClick={handleReplace}
                      disabled={matchCount === 0 || !findText}
                      className="px-2 py-0.5 text-xs rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50 transition-colors"
                      title="Replace current match"
                    >
                      Replace
                    </button>
                    <button
                      onClick={handleReplaceAll}
                      disabled={matchCount === 0 || !findText}
                      className="px-2 py-0.5 text-xs rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50 transition-colors"
                      title="Replace all matches"
                    >
                      Replace All
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto editor-main p-3">
                <div className="border border-border/60 rounded-sm bg-background p-4">
                  <EditorContent editor={mainEditor} />
                </div>
              </div>
            </div>

            {/* Draggable Split Divider */}
            <div
              className="editor-split-divider"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const container = (e.currentTarget as HTMLElement).parentElement;
                if (!container) return;
                const startX = e.clientX;
                const startPercent = splitPercent;

                const onMouseMove = (e: MouseEvent) => {
                  const rect = container.getBoundingClientRect();
                  const deltaX = e.clientX - startX;
                  const deltaPercent = (deltaX / rect.width) * 100;
                  const newPercent = Math.max(30, Math.min(80, startPercent + deltaPercent));
                  setSplitPercent(newPercent);
                };

                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
            />

            {/* Information Editor (Right) */}
            <div className="flex flex-col overflow-hidden editor-info-panel" style={{ width: `${100 - splitPercent}%`, minWidth: 0 }}>
              {/* Information label bar */}
              <div className="flex items-center px-2 py-0.5 border-b border-border/50 bg-secondary/20">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Information</span>
              </div>
              {/* Information Panel: Hero + Tags + Relationships + Images/Notes */}
              {currentPath && <InformationPanel currentPath={currentPath} onOpenGraph={onOpenGraph} onOpenTagSidebar={onOpenTagSidebar} username={username} />}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a file to edit, or create a new one
          </div>
        )}
      </div>

      {/* WikiLink Hover Popover */}
      {showWikiLinkPopover && wikiLinkTarget && wikiLinkAnchorRect && (
        <WikiLinkPopover
          targetName={wikiLinkTarget}
          anchorRect={wikiLinkAnchorRect}
          onOpen={(filePath) => onOpenFile?.(filePath)}
          onCreate={(name) => onCreateNamedFile?.(name)}
          onClose={() => setShowWikiLinkPopover(false)}
        />
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && emojiAnchorRect && (
        <EmojiPicker
          anchorRect={emojiAnchorRect}
          onSelect={insertEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
}

// Helper: escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}