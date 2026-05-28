import { buildGameReadyPath, detectTemplateType, type TemplateTypeConfig } from './templateDetector';

export interface GameExportCandidate {
  sourcePath: string;
  outputPath: string;
  templateType: TemplateTypeConfig;
  content: string;
}

export interface GameExportIssue {
  sourcePath: string;
  reason: string;
}

interface ParsedDocument {
  header: Record<string, string>;
  sections: Array<{ title: string; lines: string[] }>;
  templateName: string;
}

const CONTAINER_HEADINGS = new Set(['character', 'quest', 'location', 'item', 'faction', 'timeline']);
const SKIPPED_TOP_FOLDERS = new Set(['GameReady', 'Dialogue']);

export function isPotentialGameSource(path: string): boolean {
  const normalized = normalizePath(path);
  const topFolder = normalized.split('/')[0];
  return !SKIPPED_TOP_FOLDERS.has(topFolder) && /\.html?$/i.test(normalized);
}

export function isBuildEnabled(content: string): boolean {
  return /(?:<!--\s*)?Build\s*:\s*Yes/i.test(content);
}

export function isBuildDisabled(content: string): boolean {
  return /(?:<!--\s*)?Build\s*:\s*No/i.test(content);
}

export function detectTemplateName(content: string): string {
  const match = content.match(/(?:<!--\s*)?Template\s*:\s*([^-\n\r>]+)/i);
  return match?.[1]?.trim() || '';
}

export function resolveTemplateType(sourcePath: string, content: string): TemplateTypeConfig | null {
  const folderPath = normalizePath(sourcePath).split('/').slice(0, -1).join('/');
  const templateName = detectTemplateName(content).toLowerCase();

  if (templateName === 'blank') {
    return null;
  }

  if (templateName === 'creature') {
    return detectTemplateType('NPCs');
  }

  if (templateName === 'character' && normalizePath(sourcePath).startsWith('PlayerCharacters/')) {
    return detectTemplateType('PlayerCharacters');
  }

  return detectTemplateType(folderPath);
}

export function buildExportCandidate(sourcePath: string, content: string): GameExportCandidate | GameExportIssue {
  if (!isPotentialGameSource(sourcePath)) {
    return { sourcePath, reason: 'Not a source HTML document' };
  }

  if (isBuildDisabled(content)) {
    return { sourcePath, reason: 'Build flag is set to No' };
  }

  if (!isBuildEnabled(content)) {
    return { sourcePath, reason: 'Build flag is not set to Yes' };
  }

  const templateType = resolveTemplateType(sourcePath, content);
  if (!templateType || templateType.isAggregator) {
    return { sourcePath, reason: 'Template type is not exportable' };
  }

  const fileName = normalizePath(sourcePath).split('/').pop()?.replace(/\.[^.]+$/, '') || 'export';
  return {
    sourcePath,
    outputPath: buildGameReadyPath(templateType, fileName),
    templateType,
    content: convertHtmlToGameTxt(content, sourcePath, templateType),
  };
}

export function convertHtmlToGameTxt(content: string, sourcePath: string, templateType: TemplateTypeConfig): string {
  const parsed = parseHtmlDocument(content);
  const sourceName = normalizePath(sourcePath).split('/').pop()?.replace(/\.[^.]+$/, '') || 'export';

  switch (templateType.id) {
    case 'playerCharacter':
      return formatPlayerCharacter(parsed, sourcePath, sourceName);
    case 'quest':
      return formatQuest(parsed, sourcePath, sourceName);
    case 'mainStory':
      return formatMainStory(parsed, sourcePath, sourceName);
    case 'location':
      return formatLocation(parsed, sourcePath, sourceName);
    case 'item':
      return formatItem(parsed, sourcePath, sourceName);
    case 'faction':
      return formatGenericProfile(parsed, sourcePath, sourceName, [
        ['Name', sourceName],
        ['FactionType', getHeader(parsed, 'Type', 'Faction')],
        ['Alignment', getHeader(parsed, 'Alignment', 'Neutral')],
        ['Description', getFirstSectionText(parsed, ['Description', 'Notes'])],
      ]);
    case 'npc':
    default:
      return formatNpc(parsed, sourcePath, sourceName);
  }
}

function parseHtmlDocument(content: string): ParsedDocument {
  const templateName = detectTemplateName(content);
  const parser = new DOMParser();
  const doc = parser.parseFromString(content.replace(/<!-- MARGIN_SPLIT -->/g, ''), 'text/html');
  const parsed: ParsedDocument = { header: {}, sections: [], templateName };
  let currentSection: { title: string; lines: string[] } | null = null;

  const visit = (element: Element) => {
    const tagName = element.tagName.toLowerCase();
    const text = cleanText(element.textContent || '');

    if (!text) return;

    if ((tagName === 'h2' || tagName === 'h1') && CONTAINER_HEADINGS.has(text.toLowerCase())) {
      return;
    }

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
      currentSection = { title: text, lines: [] };
      parsed.sections.push(currentSection);
      return;
    }

    if (tagName === 'h4') {
      addSectionLine(parsed, currentSection, text);
      return;
    }

    if (tagName === 'li') {
      addSectionLine(parsed, currentSection, text);
      return;
    }

    if (tagName !== 'p' && tagName !== 'div') {
      return;
    }

    const header = parseHeaderLine(text);
    if (header && !currentSection) {
      parsed.header[header.key] = header.value;
      return;
    }

    addSectionLine(parsed, currentSection, text);
  };

  Array.from(doc.body.querySelectorAll('h1,h2,h3,h4,p,li')).forEach(visit);
  return parsed;
}

function formatNpc(parsed: ParsedDocument, sourcePath: string, sourceName: string): string {
  const isCreature = parsed.templateName.toLowerCase() === 'creature';
  const lines = buildHeader([
    ['Name', getHeader(parsed, 'Name', sourceName)],
    ['NPCType', isCreature ? 'Creature' : 'Character'],
    ['Role', getHeader(parsed, 'Role', isCreature ? 'Creature' : 'Character')],
    ['Personality', getHeader(parsed, 'Personality', 'Unknown')],
    ['Location', getHeader(parsed, 'Location', 'Unknown')],
    ['Status', normalizeStatus(getHeader(parsed, 'Status', 'Available'))],
    ['WORBI_DocumentID', sourcePath],
  ]);

  appendSection(lines, 'Backstory', getSectionLines(parsed, 'Backstory'));
  appendSection(lines, 'Creature Data', isCreature ? getCreatureData(parsed) : []);
  appendSection(lines, 'Abilities', getSectionLines(parsed, 'Abilities'));
  appendSection(lines, 'Relationships', getSectionLines(parsed, 'Relationships').map(normalizeNpcLine));
  appendSection(lines, 'Quests', getSectionLines(parsed, 'Quests'));
  appendSection(lines, 'Greeting', getSectionLines(parsed, 'Quotes').slice(0, 1));
  appendRemainingSections(lines, parsed, ['Backstory', 'Abilities', 'Relationships', 'Quests', 'Quotes']);
  return finish(lines);
}

function formatPlayerCharacter(parsed: ParsedDocument, sourcePath: string, sourceName: string): string {
  const lines = buildHeader([
    ['Name', getHeader(parsed, 'Name', sourceName)],
    ['Class', getHeader(parsed, 'Role', 'Adventurer')],
    ['Level', getHeader(parsed, 'Level', '1')],
    ['HP', getHeader(parsed, 'HP', '100')],
    ['MaxHP', getHeader(parsed, 'MaxHP', '100')],
    ['ATK', getHeader(parsed, 'ATK', '10')],
    ['DEF', getHeader(parsed, 'DEF', '5')],
    ['SPI', getHeader(parsed, 'SPI', '10')],
    ['SPD', getHeader(parsed, 'SPD', '10')],
    ['WORBI_DocumentID', sourcePath],
  ]);

  appendSection(lines, 'Backstory', getSectionLines(parsed, 'Backstory'));
  appendSection(lines, 'Personality', [getHeader(parsed, 'Personality')].filter(Boolean));
  appendSection(lines, 'Abilities', getSectionLines(parsed, 'Abilities'));
  appendSection(lines, 'Equipment', getSectionLines(parsed, 'Inventory'));
  appendRemainingSections(lines, parsed, ['Backstory', 'Abilities', 'Inventory']);
  return finish(lines);
}

function formatQuest(parsed: ParsedDocument, sourcePath: string, sourceName: string): string {
  const relatedNpcs = getHeader(parsed, 'Related NPCs') || getHeader(parsed, 'NPCs Involved');
  const lines = buildHeader([
    ['QuestID', getHeader(parsed, 'Quest ID', sourceName)],
    ['Title', getHeader(parsed, 'Title', sourceName)],
    ['QuestType', getHeader(parsed, 'Type', 'Side')],
    ['Status', normalizeStatus(getHeader(parsed, 'Status', 'Available'))],
    ['NPCs Involved', relatedNpcs],
    ['Location', getHeader(parsed, 'Location')],
    ['WORBI_DocumentID', sourcePath],
  ]);

  appendSection(lines, 'Description', getFirstAvailableSection(parsed, ['Description', 'Story Beats', 'Notes']));
  appendSection(lines, 'Objectives', getSectionLines(parsed, 'Objectives'));
  appendSection(lines, 'Rewards', getSectionLines(parsed, 'Rewards'));
  appendSection(lines, 'Prerequisites', getSectionLines(parsed, 'Prerequisites'));
  if (relatedNpcs) appendSection(lines, 'NPCs Involved', splitList(relatedNpcs));
  appendRemainingSections(lines, parsed, ['Description', 'Objectives', 'Rewards', 'Prerequisites']);
  return finish(lines);
}

function formatMainStory(parsed: ParsedDocument, sourcePath: string, sourceName: string): string {
  const lines = buildHeader([
    ['Title', getHeader(parsed, 'Title', sourceName)],
    ['Description', getFirstSectionText(parsed, ['Setting'])],
    ['NPCS Involved', getHeader(parsed, 'Key Characters')],
    ['WORBI_DocumentID', sourcePath],
  ]);

  appendSectionsAsChapters(lines, parsed);
  appendRemainingSections(lines, parsed, ['Act 1', 'Act 2', 'Act 3']);
  return finish(lines);
}

function formatLocation(parsed: ParsedDocument, sourcePath: string, sourceName: string): string {
  const lines = buildHeader([
    ['Name', getHeader(parsed, 'Name', sourceName)],
    ['LocationType', getHeader(parsed, 'Type', 'Location')],
    ['Description', getFirstSectionText(parsed, ['Description'])],
    ['ConnectedTo', getHeader(parsed, 'Connected To')],
    ['Region', getHeader(parsed, 'Region')],
    ['WORBI_DocumentID', sourcePath],
  ]);

  appendSection(lines, 'Detailed Description', getSectionLines(parsed, 'Description'));
  appendSection(lines, 'Notable Features', getSectionLines(parsed, 'Points of Interest'));
  appendSection(lines, 'Associated NPCs', getSectionLines(parsed, 'Inhabitants').map(normalizeNpcLine));
  appendSection(lines, 'Associated Quests', getSectionLines(parsed, 'Quest Integration'));
  appendRemainingSections(lines, parsed, ['Description', 'Points of Interest', 'Inhabitants', 'Quest Integration']);
  return finish(lines);
}

function formatItem(parsed: ParsedDocument, sourcePath: string, sourceName: string): string {
  const type = getHeader(parsed, 'Type', 'Item');
  const lines = buildHeader([
    ['Name', getHeader(parsed, 'Name', sourceName)],
    ['ItemType', type],
    ['Rarity', getHeader(parsed, 'Rarity', 'Common')],
    ['Description', getFirstSectionText(parsed, ['Description'])],
    ['StackSize', getHeader(parsed, 'StackSize', '1')],
    ['Weight', getHeader(parsed, 'Weight', '0')],
    ['Stackable', getHeader(parsed, 'Stackable', 'false')],
    ['Equippable', getHeader(parsed, 'Equippable', 'false')],
    ['QuestItem', /quest/i.test(type) ? 'true' : 'false'],
    ['WORBI_DocumentID', sourcePath],
  ]);

  appendSection(lines, 'Lore', getSectionLines(parsed, 'Lore'));
  appendSection(lines, 'Effect', getSectionLines(parsed, 'Effects'));
  appendSection(lines, 'Required Quests', getSectionLines(parsed, 'Quest Uses'));
  appendSection(lines, 'Found in Locations', getSectionLines(parsed, 'Locations'));
  appendRemainingSections(lines, parsed, ['Description', 'Lore', 'Effects', 'Quest Uses', 'Locations']);
  return finish(lines);
}

function formatGenericProfile(parsed: ParsedDocument, sourcePath: string, sourceName: string, headers: Array<[string, string]>): string {
  const lines = buildHeader([...headers, ['WORBI_DocumentID', sourcePath]]);
  appendRemainingSections(lines, parsed, []);
  return finish(lines);
}

function appendSectionsAsChapters(lines: string[], parsed: ParsedDocument) {
  const acts = parsed.sections.filter(section => /^Act\s+\d+/i.test(section.title));
  if (acts.length === 0) {
    appendRemainingSections(lines, parsed, []);
    return;
  }

  acts.forEach((act, index) => {
    const title = act.lines[0] || act.title.replace(/^Act\s+\d+\s*:?\s*/i, '') || `Chapter ${index + 1}`;
    lines.push('');
    lines.push(`Chapter ${index + 1}: ${title}`);
    lines.push(`Summary: ${act.lines.slice(1).join(' ') || title}`);
    lines.push('');
    lines.push(`Step 1: ${act.lines.join(' ') || title}`);
  });
}

function getCreatureData(parsed: ParsedDocument): string[] {
  const abilities = getSectionLines(parsed, 'Abilities');
  return abilities.length > 0 ? abilities : ['EncounterRole: Creature'];
}

function addSectionLine(parsed: ParsedDocument, currentSection: { title: string; lines: string[] } | null, text: string) {
  const header = parseHeaderLine(text);
  if (header && !currentSection) {
    parsed.header[header.key] = header.value;
    return;
  }

  if (currentSection) {
    currentSection.lines.push(text);
  }
}

function parseHeaderLine(text: string): { key: string; value: string } | null {
  const match = text.match(/^([^:]{2,40}):\s*(.*)$/);
  if (!match) return null;
  return { key: match[1].trim(), value: match[2].trim() };
}

function getHeader(parsed: ParsedDocument, key: string, fallback = ''): string {
  const exact = parsed.header[key];
  if (exact !== undefined) return exact;

  const normalized = normalizeKey(key);
  const match = Object.entries(parsed.header).find(([candidate]) => normalizeKey(candidate) === normalized);
  return match?.[1] || fallback;
}

function getSectionLines(parsed: ParsedDocument, title: string): string[] {
  const normalized = normalizeKey(title);
  const section = parsed.sections.find(candidate => normalizeKey(candidate.title) === normalized);
  return section ? [...section.lines] : [];
}

function getFirstAvailableSection(parsed: ParsedDocument, titles: string[]): string[] {
  for (const title of titles) {
    const lines = getSectionLines(parsed, title);
    if (lines.length > 0) return lines;
  }
  return [];
}

function getFirstSectionText(parsed: ParsedDocument, titles: string[]): string {
  return getFirstAvailableSection(parsed, titles).join(' ').trim();
}

function appendRemainingSections(lines: string[], parsed: ParsedDocument, handledTitles: string[]) {
  const handled = new Set(handledTitles.map(normalizeKey));
  for (const section of parsed.sections) {
    if (handled.has(normalizeKey(section.title)) || section.lines.length === 0) continue;
    appendSection(lines, section.title, section.lines);
  }
}

function appendSection(lines: string[], title: string, sectionLines: string[]) {
  const cleanLines = sectionLines.map(cleanText).filter(Boolean);
  if (cleanLines.length === 0) return;

  lines.push('');
  lines.push(`[${title}]`);
  lines.push(...cleanLines);
}

function buildHeader(fields: Array<[string, string]>): string[] {
  return fields
    .map(([key, value]) => [key, cleanText(value)] as [string, string])
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}: ${value}`);
}

function normalizeNpcLine(line: string): string {
  return line.replace(/^NPC:\s*-\s*/i, 'NPC: ').replace(/^NPC:\s*/i, 'NPC: ');
}

function normalizeStatus(value: string): string {
  return /^active$/i.test(value) ? 'Available' : value;
}

function splitList(value: string): string[] {
  return value.split(',').map(part => part.trim()).filter(Boolean);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function finish(lines: string[]): string {
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
