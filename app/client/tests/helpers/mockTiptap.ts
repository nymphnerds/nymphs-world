import { vi } from 'vitest';

/**
 * Mocks the @tiptap/react package for component tests.
 * Use with: vi.mock('@tiptap/react', () => mockTiptapReact())
 */
export function mockTiptapReact() {
  const mockEditor = {
    chain: () => ({
      focus: vi.fn().mockReturnThis(),
      insertContent: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnValue(true),
    }),
    focus: vi.fn(),
    setContent: vi.fn(),
    getHTML: vi.fn().mockReturnValue(''),
    getText: vi.fn().mockReturnValue(''),
    isActive: vi.fn().mockReturnValue(false),
    isFocused: vi.fn().mockReturnValue(false),
    commands: {
      focus: vi.fn().mockReturnValue(true),
      insertContent: vi.fn().mockReturnValue(true),
    },
    state: {
      doc: {},
      selection: {},
    },
    view: {
      dispatch: vi.fn(),
      props: {},
    },
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    useEditor: vi.fn().mockReturnValue(mockEditor),
    EditorContent: vi.fn(({ editor }: { editor: any }) => null),
    BubbleMenu: vi.fn(() => null),
    FloatingMenu: vi.fn(() => null),
  };
}

/**
 * Mocks the @tiptap/react useEditor hook directly.
 * Use in individual tests when you need more control.
 */
export function mockUseEditor(customEditor?: any) {
  const defaultEditor = {
    chain: () => ({
      focus: vi.fn().mockReturnThis(),
      insertContent: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnValue(true),
    }),
    focus: vi.fn(),
    setContent: vi.fn(),
    getHTML: vi.fn().mockReturnValue(''),
    getText: vi.fn().mockReturnValue(''),
    isActive: vi.fn().mockReturnValue(false),
    commands: {
      focus: vi.fn().mockReturnValue(true),
      insertContent: vi.fn().mockReturnValue(true),
    },
    state: { doc: {}, selection: {} },
    view: { dispatch: vi.fn(), props: {} },
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  };

  vi.mocked(require('@tiptap/react').useEditor).mockReturnValue(customEditor || defaultEditor);
}