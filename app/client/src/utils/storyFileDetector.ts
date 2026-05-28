/**
 * Story File Detector — Parses build metadata from game template .html files.
 *
 * Template files include structured metadata as HTML comments at the top:
 *   <!-- Build: Yes -->
 *   <!-- Template: Character -->
 *
 * This utility reads those comments to determine:
 * - Whether the file is marked for inclusion in the story build (`Build: Yes`)
 * - What template type it belongs to (`Template: <type>`)
 * - Whether the file is an auto-detect candidate (has section headings but missing Build marker)
 */

import { detectTemplateType, GENERATOR_TYPES } from './templateDetector';

/** Known template type names that appear in `Template:` metadata */
export const KNOWN_TEMPLATE_TYPES = [
  'Character',
  'Quest',
  'Location',
  'Item',
  'Faction',
  'Creature',
  'Timeline',
];

/**
 * Parsed story metadata from a file's content.
 */
export interface StoryMetadata {
  /** Whether `Build: Yes` is present */
  isIncluded: boolean;
  /** The `Template: <type>` value, or null if not present */
  templateType: string | null;
  /** Raw key-value pairs from the metadata header */
  raw: Record<string, string>;
}

/**
 * Result of auto-detecting whether a file is a template candidate.
 */
export interface AutoDetectResult {
  /** True if the file looks like a template but is missing `Build: Yes` */
  isCandidate: boolean;
  /** Detected template type from folder path, or null */
  detectedTemplateType: string | null;
  /** Reason string for UI display */
  reason: string;
}

/**
 * Parse the metadata header lines from file content.
 *
 * Metadata headers are `Key: Value` lines at the top of the file,
 * before the first `[Section]` block or blank-line-then-section pattern.
 *
 * @param content - The raw text content of the file
 * @returns Parsed StoryMetadata
 */
export function parseStoryMetadata(content: string): StoryMetadata {
  const raw: Record<string, string> = {};

  // Parse HTML comment metadata: <!-- Build: Yes --> / <!-- Template: Character -->
  const commentRegex = /<!--\s*([A-Za-z]+):\s*([^-]+)-->/g;
  let match;
  while ((match = commentRegex.exec(content)) !== null) {
    raw[match[1]] = match[2].trim();
  }

  // Also support legacy plain-text metadata for migration compatibility
  if (Object.keys(raw).length === 0) {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('[')) break;
      const lineMatch = trimmed.match(/^([A-Za-z]+):\s*(.+)$/);
      if (lineMatch) {
        raw[lineMatch[1]] = lineMatch[2];
      } else {
        break;
      }
    }
  }

  const isIncluded = raw['Build']?.toLowerCase() === 'yes';
  const templateType = KNOWN_TEMPLATE_TYPES.includes(raw['Template'] || '')
    ? raw['Template']
    : null;

  return { isIncluded, templateType, raw };
}

/**
 * Check if a file is marked for inclusion in the story build.
 *
 * @param content - The raw text content of the file
 * @returns true if `Build: Yes` is present in the metadata
 */
export function isStoryFile(content: string): boolean {
  return parseStoryMetadata(content).isIncluded;
}

/**
 * Detect the template type from the file's `Template:` metadata.
 *
 * @param content - The raw text content of the file
 * @returns The template type string, or null
 */
export function detectTemplateFromContent(content: string): string | null {
  return parseStoryMetadata(content).templateType;
}

/**
 * Check if a file has [Section] blocks (template-like structure).
 */
function hasSectionBlocks(content: string): boolean {
  return /\[.+\]/.test(content);
}

/**
 * Auto-detect whether a file is a template candidate.
 *
 * A file is a candidate if:
 * - It's in a known template folder (detected by folderPath)
 * - It has [Section] blocks (template-like structure)
 * - It does NOT have `Build: Yes` (otherwise it's already confirmed)
 *
 * @param content - The raw text content of the file
 * @param filePath - The full file path (e.g., "NPCs/character_name.txt")
 * @returns AutoDetectResult with candidate status and reason
 */
export function autoDetectTemplateCandidate(content: string, filePath: string): AutoDetectResult {
  const metadata = parseStoryMetadata(content);

  // Already confirmed — not a candidate
  if (metadata.isIncluded) {
    return {
      isCandidate: false,
      detectedTemplateType: metadata.templateType,
      reason: 'Already marked for build',
    };
  }

  const fileName = filePath.split('/').pop() || filePath;
  const folderPath = filePath.substring(0, filePath.lastIndexOf('/')) || '';
  const detected = detectTemplateType(folderPath);

  if (!detected) {
    return {
      isCandidate: false,
      detectedTemplateType: null,
      reason: 'File is not in a recognized template folder',
    };
  }

  if (!hasSectionBlocks(content)) {
    return {
      isCandidate: false,
      detectedTemplateType: detected.label,
      reason: 'File does not have [Section] blocks (not template-structured)',
    };
  }

  // Has section blocks + in template folder but missing Build: Yes
  return {
    isCandidate: true,
    detectedTemplateType: detected.label,
    reason: `Detected in ${folderPath}/ with template structure`,
  };
}

/**
 * Get the template type label from a folder path for marking purposes.
 *
 * @param folderPath - The folder path (e.g., "NPCs")
 * @returns The template type string (e.g., "Character"), or null
 */
export function getTemplateTypeForFolder(folderPath: string): string | null {
  const detected = detectTemplateType(folderPath);
  if (!detected) return null;

  // Map promptKey to template type name
  const keyToType: Record<string, string> = {
    npc: 'Character',
    quest: 'Quest',
    mainStory: 'Timeline',
    location: 'Location',
    item: 'Item',
    faction: 'Faction',
    noticeBoard: 'Character', // NoticeBoard is a type of NPC/Character
  };

  return keyToType[detected.promptKey] || null;
}

/**
 * Prepend build metadata to file content if not already present.
 *
 * @param content - Current file content
 * @param templateType - The template type to set (e.g., "Character")
 * @returns New content with Build: Yes and Template: <type> at the top
 */
export function addBuildMetadata(content: string, templateType: string): string {
  const metadata = parseStoryMetadata(content);
  if (metadata.isIncluded) return content; // Already has it

  // Insert HTML comment metadata after the opening content (prepend to body-like content)
  const header = `<!-- Build: Yes -->\n<!-- Template: ${templateType} -->\n`;
  return header + content;
}

/**
 * Remove the Build: Yes line from file content.
 *
 * @param content - Current file content
 * @returns Content with Build: Yes line removed
 */
export function removeBuildMetadata(content: string): string {
  // Remove HTML comment Build: Yes
  let result = content.replace(/<!--\s*Build:\s*[Yy][Ee][Ss]\s*-->\n?/g, '');
  // Also support legacy plain-text Build: Yes
  const lines = result.split('\n');
  const filtered = lines.filter(line => !line.trim().match(/^Build:\s*[Yy][Ee][Ss]$/));
  return filtered.join('\n');
}
