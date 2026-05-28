import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockTiptapReact } from '../../tests/helpers/mockTiptap';

// ---- Mock TipTap ----
vi.mock('@tiptap/react', () => {
  const mockChain = { run: vi.fn(), focus: vi.fn(), insertContent: vi.fn().mockReturnThis() };
  const mockCanChain = { undo: vi.fn().mockReturnValue(false), redo: vi.fn().mockReturnValue(false), toggleBold: vi.fn().mockReturnValue(false), toggleItalic: vi.fn().mockReturnValue(false) };
  const mockCommands = { focus: vi.fn(), insertContent: vi.fn(), undo: vi.fn(), redo: vi.fn(), toggleBold: vi.fn(), toggleItalic: vi.fn(), toggleUnderline: vi.fn(), toggleBulletList: vi.fn(), toggleOrderedList: vi.fn(), toggleHeading: vi.fn(), createParagraphNear: vi.fn(), setContent: vi.fn(), clearContent: vi.fn() };
  const mockEditor = {
    chain: vi.fn().mockReturnValue(mockChain),
    focus: vi.fn(),
    setContent: vi.fn(),
    getHTML: vi.fn().mockReturnValue(''),
    getText: vi.fn().mockReturnValue(''),
    isActive: vi.fn().mockReturnValue(false),
    isFocused: vi.fn().mockReturnValue(false),
    can: vi.fn().mockReturnValue(mockCanChain),
    commands: mockCommands,
    state: { doc: {}, selection: {} },
    view: { dispatch: vi.fn(), props: {} },
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    useEditor: vi.fn().mockReturnValue(mockEditor),
    EditorContent: vi.fn(({ editor }: any) => null),
    BubbleMenu: vi.fn(() => null),
    FloatingMenu: vi.fn(() => null),
  };
});

// ---- Mock TipTap extensions ----
vi.mock('@tiptap/core', () => ({
  Extension: {
    create: vi.fn().mockReturnValue({}),
  },
}));
vi.mock('@tiptap/starter-kit', () => ({
  default: { configure: function () { return this; } },
}));
vi.mock('@tiptap/extension-underline', () => ({
  default: { configure: function () { return this; } },
}));
vi.mock('@tiptap/extension-link', () => ({
  default: { configure: function () { return this; } },
}));
vi.mock('@tiptap/extension-table', () => ({
  Table: { configure: function () { return this; } },
}));
vi.mock('@tiptap/extension-table-row', () => ({
  default: { configure: function () { return this; } },
}));
vi.mock('@tiptap/extension-table-cell', () => ({
  default: { configure: function () { return this; } },
}));
vi.mock('@tiptap/extension-table-header', () => ({
  default: { configure: function () { return this; } },
}));
vi.mock('@tiptap/extension-placeholder', () => ({
  default: { configure: function () { return this; } },
}));
vi.mock('prosemirror-state', () => ({
  Plugin: vi.fn(),
  PluginKey: vi.fn(),
}));
vi.mock('prosemirror-view', () => ({
  Decoration: vi.fn(),
  DecorationSet: vi.fn(),
}));

// ---- Mock local extensions ----
vi.mock('../extensions/resize-image', () => ({
  ImageResize: { configure: function () { return this; } },
}));
vi.mock('../extensions/spellcheck', () => ({
  Spellcheck: { configure: function () { return this; } },
  MisspelledMark: { configure: function () { return this; } },
  runSpellcheck: vi.fn(),
  clearSpellcheckMarks: vi.fn(),
}));
vi.mock('../extensions/wiki-link', () => ({
  WikiLink: { configure: function () { return this; } },
  wikiLinkRegex: /\[\[([^\]]+)\]\]/g,
  parseWikiLinkText: vi.fn((text: string) => ({ label: text, target: text })),
}));

// ---- Mock sub-components ----
vi.mock('./TagInsertControl', () => ({
  TagInsertControl: vi.fn(() => <div data-testid="tag-insert-control" />),
}));
vi.mock('./InformationPanel', () => ({
  InformationPanel: vi.fn(() => <div data-testid="information-panel" />),
}));
vi.mock('./WikiLinkPopover', () => ({
  WikiLinkPopover: vi.fn(() => null),
}));
vi.mock('./WikiLinkAutocomplete', () => ({
  WikiLinkAutocomplete: vi.fn(() => null),
}));
vi.mock('./EmojiPicker', () => ({
  EmojiPicker: vi.fn(() => null),
}));

// ---- Mock API ----
vi.mock('../services/api', () => ({
  sendCompletion: vi.fn().mockResolvedValue({ content: '' }),
  resolveWikiLink: vi.fn().mockResolvedValue(null),
  searchWikiLinks: vi.fn().mockResolvedValue([]),
}));

// ---- Mock lucide-react icons ----
vi.mock('lucide-react', () => {
  const icons: Record<string, React.FC> = {};
  const iconNames = [
    'Save', 'FilePlus', 'Download', 'FileText', 'FileSpreadsheet',
    'Bold', 'Italic', 'Underline', 'Undo2', 'Redo2',
    'List', 'ListOrdered', 'Table', 'Image', 'CheckCheck',
    'Search', 'Replace', 'X', 'ChevronLeft', 'ChevronRight', 'ChevronDown',
    'Sparkles', 'Loader2', 'RotateCcw', 'Smile',
  ];
  for (const name of iconNames) {
    icons[name] = vi.fn((props: any) => <svg data-testid={name} {...props} />);
  }
  return icons;
});

// Import after mocks are set up
import { DocumentEditor } from './DocumentEditor';

describe('DocumentEditor', () => {
  const props: any = {
    content: '<p>Hello World</p>',
    currentPath: 'Lore/test.html',
    loading: false,
    dirty: false,
    canRestore: false,
    originalContent: '<p>Hello World</p>',
    onChange: vi.fn(),
    onSave: vi.fn(),
    onRestore: vi.fn(),
    onCreateFile: vi.fn(),
    onDownload: vi.fn(),
    onExportPDF: vi.fn(),
    onExportDOCX: vi.fn(),
    imageToInsert: null,
    onImageInserted: vi.fn(),
    onOpenTagSidebar: vi.fn(),
    onOpenFile: vi.fn(),
    onCreateNamedFile: vi.fn(),
    onOpenGraph: vi.fn(),
    username: 'testuser',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    props.onChange.mockClear();
    props.onSave.mockClear();
  });

  it('renders the editor without crashing', () => {
    render(<DocumentEditor {...props} />);
    expect(screen.getByTestId('Bold')).toBeTruthy();
  });

  it('renders the toolbar with formatting buttons', () => {
    render(<DocumentEditor {...props} />);
    expect(screen.getByTestId('Bold')).toBeTruthy();
    expect(screen.getByTestId('Italic')).toBeTruthy();
    expect(screen.getByTestId('Underline')).toBeTruthy();
  });

  it('renders the save button', () => {
    render(<DocumentEditor {...props} />);
    expect(screen.getByTestId('Save')).toBeTruthy();
  });

  it('calls onSave when save button is clicked', () => {
    render(<DocumentEditor {...props} />);
    const saveBtn = screen.getByTestId('Save');
    fireEvent.click(saveBtn);
    expect(props.onSave).toHaveBeenCalled();
  });

  it('renders the InformationPanel', () => {
    render(<DocumentEditor {...props} />);
    expect(screen.getByTestId('information-panel')).toBeTruthy();
  });
});