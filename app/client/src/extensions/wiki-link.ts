import { Mark, InputRule } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface WikiLinkOptions {
  onLinkClick?: (targetName: string, exists: boolean, filePath: string | null) => void;
  onHover?: (targetName: string, exists: boolean, filePath: string | null, element: HTMLElement) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attributes: { targetName: string; displayText?: string; exists?: boolean; filePath?: string | null }) => ReturnType;
    };
  }
}

export const WikiLink = Mark.create<WikiLinkOptions>({
  name: 'wikiLink',

  addOptions() {
    return {
      onLinkClick: undefined,
      onHover: undefined,
    };
  },

  addAttributes() {
    return {
      targetName: {
        default: '',
        renderHTML(attributes) {
          if (!attributes.targetName) return {};
          return { 'data-target-name': attributes.targetName };
        },
      },
      displayText: {
        default: '',
        renderHTML: () => ({}),
      },
      exists: {
        default: null,
        renderHTML(attributes) {
          if (attributes.exists === null) return {};
          return { 'data-exists': String(attributes.exists) };
        },
      },
      filePath: {
        default: null,
        renderHTML(attributes) {
          if (!attributes.filePath) return {};
          return { 'data-file-path': attributes.filePath };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
        getAttrs: (element) => {
          const dom = element as HTMLElement;
          return {
            targetName: dom.getAttribute('data-target-name') || '',
            displayText: dom.textContent || '',
            exists: dom.hasAttribute('data-exists') ? dom.getAttribute('data-exists') === 'true' : null,
            filePath: dom.getAttribute('data-file-path') || null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const existsVal = HTMLAttributes['data-exists'];
    let classes: string;

    if (existsVal === 'true') {
      classes = 'wiki-link wiki-link-exists';
    } else if (existsVal === 'false') {
      classes = 'wiki-link wiki-link-missing';
    } else {
      classes = 'wiki-link wiki-link-resolving';
    }

    return [
      'span',
      {
        ...HTMLAttributes,
        class: classes,
        'data-wiki-link': '',
      },
      0,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attributes) =>
        ({ chain }) => {
          return chain()
            .setMark(this.name, {
              targetName: attributes.targetName,
              displayText: attributes.displayText || attributes.targetName,
              exists: attributes.exists ?? null,
              filePath: attributes.filePath ?? null,
            })
            .run();
        },
    };
  },

  addInputRules() {
    const markName = this.name;
    return [
      new InputRule({
        find: /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]$/,
        handler({ range, match, chain }) {
          const targetName = match[1].trim();
          const displayText = match[2]?.trim() || `📒 Link to: ${targetName}`;

          if (!targetName) return;

          // chain() returns ChainedCommands which is properly chainable
          // deleteRange removes the [[...]] text, then insertContent adds styled text
          chain()
            .deleteRange(range)
            .insertContent({
              type: 'text',
              text: displayText,
              marks: [{
                type: markName,
                attrs: {
                  targetName,
                  displayText,
                  exists: null,
                  filePath: null,
                },
              }],
            })
            .run();
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const { onLinkClick, onHover } = this.options;

    // Plugin: Click and hover handlers
    const createInteractionPlugin = (): Plugin => {
      let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

      return new Plugin({
        props: {
          handleDOMEvents: {
            click: (_view: EditorView, event: MouseEvent): boolean => {
              const target = event.target as HTMLElement | null;
              if (!target) return false;
              const wikiSpan = target.closest('span[data-wiki-link]') as HTMLElement | null;

              if (wikiSpan) {
                event.preventDefault();
                event.stopPropagation();
                const targetName = wikiSpan.getAttribute('data-target-name') || '';
                const exists = wikiSpan.getAttribute('data-exists') === 'true';
                const filePath = wikiSpan.getAttribute('data-file-path') || null;

                onLinkClick?.(targetName, exists, filePath);
                return true;
              }
              return false;
            },
            mouseover: (_view: EditorView, event: MouseEvent): boolean => {
              const target = event.target as HTMLElement | null;
              if (!target) return false;
              const wikiSpan = target.closest('span[data-wiki-link]') as HTMLElement | null;

              if (wikiSpan) {
                if (hoverTimeout) clearTimeout(hoverTimeout);

                hoverTimeout = setTimeout(() => {
                  const targetName = wikiSpan.getAttribute('data-target-name') || '';
                  const exists = wikiSpan.getAttribute('data-exists') === 'true';
                  const filePath = wikiSpan.getAttribute('data-file-path') || null;

                  onHover?.(targetName, exists, filePath, wikiSpan);
                }, 300);
              }
              return false;
            },
          },
        },
      });
    };

    return [createInteractionPlugin()];
  },
});

/**
 * Regex to match [[Target Name]] or [[Target Name|Display Text]] patterns.
 */
export const wikiLinkRegex = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/**
 * Parse a wiki link raw text and return targetName and displayText.
 */
export function parseWikiLinkText(text: string): { targetName: string; displayText: string } | null {
  const match = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/.exec(text);
  if (!match) return null;

  const targetName = match[1].trim();
  const displayText = (match[2]?.trim() || targetName);

  if (!targetName) return null;

  return { targetName, displayText };
}