import { Extension } from '@tiptap/core';
import { Mark } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import Typo from 'typo-js';

// Lazy-loaded Typo instance with English dictionary
let typoPromise: Promise<Typo> | null = null;
let typoInstance: Typo | null = null;

function initTypo(): Promise<Typo> {
  if (typoPromise) return typoPromise;

  typoPromise = (async () => {
    const [affResponse, dicResponse] = await Promise.all([
      fetch('/dictionaries/en_US/en_US.aff'),
      fetch('/dictionaries/en_US/en_US.dic'),
    ]);
    const affData = await affResponse.text();
    const dicData = await dicResponse.text();
    const instance = new Typo('en_US', affData, dicData);
    typoInstance = instance;
    return instance;
  })();

  return typoPromise;
}

function isMisspelled(word: string): boolean {
  if (!typoInstance || !typoInstance.loaded) return false;
  const stripped = word.replace(/[^a-zA-Z']/g, '');
  if (stripped.length < 2) return false;
  try {
    return !typoInstance.check(stripped);
  } catch {
    return false;
  }
}

function getSuggestions(word: string): string[] {
  if (!typoInstance || !typoInstance.loaded) return [];
  const stripped = word.replace(/[^a-zA-Z']/g, '');
  if (stripped.length < 2) return [];
  try {
    return typoInstance.suggest(stripped, 5);
  } catch {
    return [];
  }
}

/**
 * Run spellcheck on the given Tiptap editor. Returns the count of misspelled words.
 * Applies misspelled marks in a single batch transaction at the end (no UI freeze).
 * Loads the dictionary on first call.
 */
export async function runSpellcheck(editor: Editor): Promise<number> {
  // Ensure dictionary is loaded
  if (!typoInstance) {
    await initTypo();
  }
  if (!typoInstance || !typoInstance.loaded) {
    return 0;
  }

  // Yield to browser so the "spellchecking" UI state can render
  await new Promise(r => setTimeout(r, 0));

  const fullText = editor.state.doc.textContent;
  if (fullText.length > 50000) return 0;

  const markType = editor.schema.marks.misspelled;

  // Collect unique words only (avoid redundant dictionary checks)
  const rawWords = fullText.split(/\s+/);
  const uniqueWords = new Set<string>();
  const wordFrequency = new Map<string, number>();

  for (const w of rawWords) {
    const stripped = w.replace(/[^a-zA-Z']/g, '').toLowerCase();
    if (stripped.length >= 2 && !uniqueWords.has(stripped)) {
      uniqueWords.add(stripped);
    }
    if (stripped.length >= 2) {
      wordFrequency.set(stripped, (wordFrequency.get(stripped) || 0) + 1);
    }
  }

  // Check only unique words against dictionary (with UI yields)
  const misspelledWords = new Set<string>();
  const uniqueArray = Array.from(uniqueWords);

  for (let i = 0; i < uniqueArray.length; i++) {
    if (isMisspelled(uniqueArray[i])) {
      misspelledWords.add(uniqueArray[i]);
    }
    // Yield every 200 unique words so the UI stays responsive
    if (i % 200 === 199) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Count total misspelled occurrences
  let count = 0;
  for (const [word, freq] of wordFrequency) {
    if (misspelledWords.has(word)) {
      count += freq;
    }
  }

  // --- Apply marks in a single batch transaction ---
  if (count === 0 || !markType) {
    return count;
  }

  // Walk the document text to find positions of misspelled words
  const nodes: Array<{ from: number; to: number; word: string }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text || '';
    // Find word boundaries in this text node
    const regex = /([a-zA-Z']{2,})/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const word = m[0].toLowerCase();
      if (misspelledWords.has(word)) {
        const from = pos + m.index;
        const to = from + m[0].length;
        nodes.push({ from, to, word });
      }
    }
  });

  // Build the suggestions cache for batch lookup
  const suggestionsCache = new Map<string, string[]>();

  // Apply all marks in one transaction
  const { tr } = editor.state;
  // First clear any existing marks
  tr.removeMark(0, tr.doc.nodeSize - 2, markType);

  // Then add all new marks
  for (const { from, to, word } of nodes) {
    const suggestions = suggestionsCache.get(word) || getSuggestions(word);
    suggestionsCache.set(word, suggestions);
    tr.addMark(from, to, markType.create({ suggestions }));
  }

  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }

  return count;
}

/**
 * Clear all spellcheck marks from the editor.
 */
export function clearSpellcheckMarks(editor: Editor): void {
  const markType = editor.schema.marks.misspelled;
  if (!markType) return;

  const { tr } = editor.state;
  tr.removeMark(0, tr.doc.nodeSize - 2, markType);
  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }
}

// ─── Mark for misspelled words ───────────────────────────
export const MisspelledMark = Mark.create({
  name: 'misspelled',

  addAttributes() {
    return {
      suggestions: {
        default: [] as string[],
      },
    };
  },

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'spellcheck-misspelled',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.spellcheck-misspelled' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return [
      'span',
      { ...HTMLAttributes, class: 'spellcheck-misspelled' },
      0,
    ];
  },
});

// ─── Dummy Extension (no plugins - spellcheck is now manual) ───
export const Spellcheck = Extension.create({
  name: 'spellcheck',
  // No plugins added - spellcheck is now user-initiated via runSpellcheck()
});