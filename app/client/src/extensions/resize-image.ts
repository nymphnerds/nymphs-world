import Image from '@tiptap/extension-image';
import { Plugin } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';

export const ImageResize = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          // Read stored width from data-width attribute in saved HTML
          return element.getAttribute('data-width') || element.getAttribute('width') || null;
        },
      },
    };
  },

  renderHTML({ HTMLAttributes, attributes }: any) {
    const width = attributes?.width || HTMLAttributes?.['data-width'] || HTMLAttributes?.width;
    const widthStyle = width ? `width:${width}px;` : '';

    return [
      'span',
      {
        class: 'image-wrapper resizable',
        contenteditable: 'false',
      },
      [
        'img',
        {
          ...HTMLAttributes,
          ...attributes,
          'data-width': width || undefined,
          style: widthStyle,
        },
      ],
      [
        'span',
        {
          class: 'resize-drag-handle',
          contenteditable: 'false',
          draggable: 'false',
        },
      ],
    ];
  },

  addCommands() {
    return {
      setImage: (options: { src: string; alt?: string; title?: string; width?: string | number }) => {
        return ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              alt: options.alt,
              title: options.title,
              width: options.width ?? null,
            },
          });
        };
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            mousedown: (view: EditorView, event: MouseEvent) => {
              const target = event.target as HTMLElement;
              if (!target) return false;

              const handle = target.classList.contains('resize-drag-handle')
                ? target
                : target.closest('.resize-drag-handle');
              if (!handle) return false;

              const wrapper = handle.closest('.image-wrapper');
              if (!wrapper) return false;

              const imageDOM = wrapper.querySelector('img');
              if (!imageDOM) return false;

              const startX = event.clientX;
              const startWidth = imageDOM.getBoundingClientRect().width;

              event.preventDefault();

              const updateSize = (e: MouseEvent) => {
                const deltaX = e.clientX - startX;
                let newWidth = startWidth + deltaX;
                newWidth = Math.max(50, newWidth);

                imageDOM.style.width = `${newWidth}px`;
                imageDOM.style.height = 'auto';
              };

              const stopResize = () => {
                const finalWidth = Math.round(Math.max(50, parseInt(imageDOM.style.width) || startWidth));

                // Walk the ProseMirror tree to find the matching image node by src
                const src = imageDOM.getAttribute('src');
                let foundPos: number | null = null;
                let foundNode: any = null;

                view.state.doc.descendants((node, pos) => {
                  if (node.type.name === 'image' && node.attrs?.src === src) {
                    foundPos = pos;
                    foundNode = node;
                  }
                });

                if (foundPos !== null && foundNode) {
                  view.dispatch(
                    view.state.tr.setNodeMarkup(
                      foundPos,
                      undefined,
                      { ...foundNode.attrs, width: String(finalWidth) }
                    )
                  );
                }

                document.removeEventListener('mousemove', updateSize as EventListener);
                document.removeEventListener('mouseup', stopResize);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
              };

              document.addEventListener('mousemove', updateSize);
              document.addEventListener('mouseup', stopResize);
              document.body.style.cursor = 'ew-resize';
              document.body.style.userSelect = 'none';

              return true;
            },
          },
        },
      }),
    ];
  },
});