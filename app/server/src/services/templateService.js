import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fileService from './fileService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Templates directory
const templatesDir = path.join(__dirname, 'data', 'templates');

// Template metadata: key, label, profile, default folder, suffix, template file
// All templates now create .html files (no suffix appended to filename)
const templateRegistry = [
  // Game (Story Writing) templates — .html files
  { key: 'playercharacter', label: 'PlayerCharacter', profile: 'game', folder: 'PlayerCharacters', suffix: 'Character', file: null },
  { key: 'npc', label: 'NPC', profile: 'game', folder: 'NPCs', suffix: 'NPC', file: null },
  { key: 'location', label: 'Location', profile: 'game', folder: 'Locations', suffix: 'Location', file: null },
  { key: 'quest', label: 'Quest', profile: 'game', folder: 'Quests', suffix: 'Quest', file: null },
  { key: 'timeline', label: 'Timeline', profile: 'game', folder: 'MainStory', suffix: 'Event', file: null },
  { key: 'item', label: 'Item', profile: 'game', folder: 'Items', suffix: 'Item', file: null },
  { key: 'faction', label: 'Faction', profile: 'game', folder: 'Factions', suffix: 'Faction', file: null },
  { key: 'creature', label: 'Creature', profile: 'game', folder: 'NPCs', suffix: 'Creature', file: null },
  // Work (Business) templates — .html files (editor-only)
  { key: 'customer', label: 'Customer', profile: 'work', folder: 'Customers', suffix: 'Customer', file: null },
  { key: 'job', label: 'Job', profile: 'work', folder: 'Jobs', suffix: 'Job', file: null },
  { key: 'booking', label: 'Booking', profile: 'work', folder: 'Bookings', suffix: 'Booking', file: null },
  { key: 'quote', label: 'Quote', profile: 'work', folder: 'Quotes', suffix: 'Quote', file: null },
  // Shared templates
  { key: 'blank', label: 'Blank', profile: 'both', folder: 'NPCs', suffix: '', file: null },
];

// Inline template content for Work templates (no file needed)
const workTemplateContent = {
  customer: (name) => `<h2>${name}</h2>
<h3>Contact Details</h3>
<p><strong>Email:</strong> </p>
<p><strong>Phone:</strong> </p>
<p><strong>Company:</strong> </p>
<h3>Notes</h3>
<p></p>`,

  job: (name) => `<h2>${name}</h2>
<h3>Job Details</h3>
<p><strong>Customer:</strong> </p>
<p><strong>Status:</strong> Not Started</p>
<p><strong>Priority:</strong> Normal</p>
<p><strong>Due Date:</strong> </p>
<h3>Description</h3>
<p></p>
<h3>Tasks</h3>
<ul><li></li></ul>`,

  booking: (name) => `<h2>${name}</h2>
<h3>Booking Details</h3>
<p><strong>Customer:</strong> </p>
<p><strong>Date:</strong> </p>
<p><strong>Time:</strong> </p>
<p><strong>Status:</strong> Pending</p>
<h3>Notes</h3>
<p></p>`,

  quote: (name) => `<h2>${name}</h2>
<h3>Quote Details</h3>
<p><strong>Customer:</strong> </p>
<p><strong>Date:</strong> </p>
<p><strong>Valid Until:</strong> </p>
<p><strong>Status:</strong> Draft</p>
<h3>Line Items</h3>
<ul><li>Item — $</li></ul>
<p><strong>Total:</strong> $</p>
<h3>Notes</h3>
<p></p>`,
};

// Inline template content for Game templates (HTML format, no file I/O needed)
// Build/Template metadata stored as HTML comments for parser compatibility
const gameTemplateContent = {
  playercharacter: `<!-- Build: Yes -->
  <!-- Template: Character -->
  <h2>Character</h2>
  <p><strong>Name:</strong> </p>
  <p><strong>Role:</strong> </p>
  <p><strong>Personality:</strong> </p>
  <p><strong>Location:</strong> </p>
  <p><strong>Status:</strong> Active</p>
  <h3>Backstory</h3>
  <p></p>
  <h3>Abilities</h3>
  <p></p>
  <h3>Relationships</h3>
  <p>NPC: - </p>
  <h3>Quotes</h3>
  <p></p>
  <h3>Inventory</h3>
  <p></p>
  <h3>Notes</h3>
  <p></p>`,

  npc: `<!-- Build: Yes -->
<!-- Template: Character -->
<h2>Character</h2>
<p><strong>Name:</strong> </p>
<p><strong>Role:</strong> </p>
<p><strong>Personality:</strong> </p>
<p><strong>Location:</strong> </p>
<p><strong>Status:</strong> Active</p>
<h3>Backstory</h3>
<p></p>
<h3>Abilities</h3>
<p></p>
<h3>Relationships</h3>
<p>NPC: - </p>
<h3>Quotes</h3>
<p></p>
<h3>Inventory</h3>
<p></p>
<h3>Notes</h3>
<p></p>`,

  quest: `<!-- Build: Yes -->
<!-- Template: Quest -->
<h2>Quest</h2>
<p><strong>Quest ID:</strong> </p>
<p><strong>Type:</strong> Main/Side/Arc</p>
<p><strong>Status:</strong> Available</p>
<p><strong>Related NPCs:</strong> </p>
<p><strong>Location:</strong> </p>
<h3>Objectives</h3>
<ol><li> </li><li> </li><li> </li></ol>
<h3>Rewards</h3>
<p></p>
<h3>Prerequisites</h3>
<p></p>
<h3>Story Beats</h3>
<h4>Act 1: Hook</h4>
<p></p>
<h4>Act 2: Development</h4>
<p></p>
<h4>Act 3: Resolution</h4>
<p></p>
<h3>Complications</h3>
<p></p>
<h3>Notes</h3>
<p></p>`,

  location: `<!-- Build: Yes -->
<!-- Template: Location -->
<h2>Location</h2>
<p><strong>Name:</strong> </p>
<p><strong>Type:</strong> </p>
<p><strong>Region:</strong> </p>
<p><strong>Connected To:</strong> </p>
<h3>Description</h3>
<p></p>
<h3>Points of Interest</h3>
<ol><li> </li><li> </li></ol>
<h3>Inhabitants</h3>
<p>NPC: - </p>
<h3>Hazards</h3>
<p></p>
<h3>History</h3>
<p></p>
<h3>Notes</h3>
<p></p>`,

  item: `<!-- Build: Yes -->
<!-- Template: Item -->
<h2>Item</h2>
<p><strong>Name:</strong> </p>
<p><strong>Type:</strong> </p>
<p><strong>Rarity:</strong> Common</p>
<p><strong>Usable:</strong> Yes</p>
<h3>Description</h3>
<p></p>
<h3>Effects</h3>
<p></p>
<h3>Lore</h3>
<p></p>
<h3>Quest Uses</h3>
<p></p>
<h3>Notes</h3>
<p></p>`,

  faction: `<!-- Build: Yes -->
<!-- Template: Faction -->
<h2>Faction</h2>
<p><strong>Name:</strong> </p>
<p><strong>Alignment:</strong> </p>
<p><strong>Leader:</strong> </p>
<p><strong>Relationship:</strong> Neutral</p>
<h3>Goals</h3>
<p></p>
<h3>Members</h3>
<p>NPC: - </p>
<h3>Relationships</h3>
<p>FACTION: - </p>
<h3>Territory</h3>
<p></p>
<h3>Notes</h3>
<p></p>`,

  creature: `<!-- Build: Yes -->
<!-- Template: Creature -->
<h2>Creature</h2>
<p><strong>Name:</strong> </p>
<p><strong>Type:</strong> </p>
<p><strong>Hostility:</strong> </p>
<p><strong>Habitat:</strong> </p>
<p><strong>Status:</strong> Wild</p>
<h3>Description</h3>
<p></p>
<h3>Behavior</h3>
<p></p>
<h3>Abilities</h3>
<p></p>
<h3>Combat Tactics</h3>
<p></p>
<h3>Lore</h3>
<p></p>
<h3>Notes</h3>
<p></p>`,

  timeline: `<!-- Build: Yes -->
<!-- Template: Timeline -->
<h2>Timeline</h2>
<p><strong>Title:</strong> </p>
<p><strong>Era:</strong> </p>
<p><strong>Connected Quests:</strong> </p>
<h3>Setting</h3>
<p></p>
<h3>Key Characters</h3>
<p>NPC: - </p>
<h3>Act 1</h3>
<p></p>
<h3>Act 2</h3>
<p></p>
<h3>Act 3</h3>
<p></p>
<h3>Consequences</h3>
<p></p>
<h3>Notes</h3>
<p></p>`,

  blank: '',
};

const templateExportNames = {
  playercharacter: 'Character',
  npc: 'Character',
  location: 'Location',
  quest: 'Quest',
  timeline: 'Timeline',
  item: 'Item',
  faction: 'Faction',
  creature: 'Creature',
  customer: 'Customer',
  job: 'Job',
  booking: 'Booking',
  quote: 'Quote',
  blank: 'Blank',
};

function ensureBuildMetadata(content, templateKey) {
  const metadata = [];
  const templateName = templateExportNames[templateKey] || templateKey;

  if (!/<!--\s*Build\s*:/i.test(content)) {
    metadata.push('<!-- Build: Yes -->');
  }

  if (!/<!--\s*Template\s*:/i.test(content)) {
    metadata.push(`<!-- Template: ${templateName} -->`);
  }

  return metadata.length > 0 ? `${metadata.join('\n')}\n${content}` : content;
}

// Get list of available templates, optionally filtered by profile
function getAvailableTemplates(profile = null) {
  let registry = templateRegistry;
  if (profile && profile !== 'both') {
    registry = templateRegistry.filter(t =>
      t.profile === profile || t.profile === 'both'
    );
  }
  return registry.map(t => ({
    key: t.key,
    label: t.label,
    profile: t.profile,
    defaultFolder: t.folder,
    suffix: t.suffix,
  }));
}

// Sanitize a name for use in filenames
function sanitizeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

// Find a unique filename by appending -2, -3, etc.
function findUniqueFileName(username, folder, desiredName) {
  const desiredPath = folder ? path.join(folder, desiredName).replace(/\\/g, '/') : desiredName;
  const fullPath = fileService.getSafePath(username, desiredPath);
  if (!fs.existsSync(fullPath)) {
    return desiredName;
  }

  const nameWithoutExt = path.basename(desiredName, path.extname(desiredName));
  const ext = path.extname(desiredName);

  for (let i = 2; i < 100; i++) {
    const candidate = `${nameWithoutExt}-${i}${ext}`;
    const candidatePath = folder ? path.join(folder, candidate).replace(/\\/g, '/') : candidate;
    const full = fileService.getSafePath(username, candidatePath);
    if (!fs.existsSync(full)) {
      return candidate;
    }
  }

  throw new Error('Could not find a unique file name');
}

// Create a file from a template
function createFromTemplate(username, templateKey, name, folder) {
  const template = templateRegistry.find(t => t.key === templateKey);
  if (!template) {
    throw new Error(`Unknown template: ${templateKey}`);
  }

  const sanitized = sanitizeName(name || 'Untitled');
  const displayName = sanitized || 'Untitled';

  // All templates create .html files — no suffix appended, just the user-provided name
  const ext = '.html';
  const fileName = `${displayName}${ext}`;

  // Use provided folder, or default for this template type
  const targetFolder = (folder !== undefined ? folder : template.folder).replace(/\\/g, '/');
  // Strip leading/trailing slashes
  const cleanFolder = targetFolder.replace(/^\/+|\/+$/g, '');

  const uniqueName = findUniqueFileName(username, cleanFolder, fileName);
  const filePath = cleanFolder ? path.join(cleanFolder, uniqueName).replace(/\\/g, '/') : uniqueName;

  // Load template content
  let content = '';

  // Check if it's a work template with inline content
  if (workTemplateContent[templateKey]) {
    content = workTemplateContent[templateKey](displayName);
  } else if (gameTemplateContent[templateKey] !== undefined) {
    // Game templates use inline content (no file I/O needed)
    content = gameTemplateContent[templateKey];
  } else if (template.file) {
    // Fallback: load from file
    const templatePath = path.join(templatesDir, template.file);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${template.file}`);
    }
    content = fs.readFileSync(templatePath, 'utf-8');
  }

  content = ensureBuildMetadata(content, templateKey);

  // Write the file
  fileService.writeFile(username, filePath, content);

  return {
    path: filePath,
    content,
  };
}

// ---- Story Bible Compiler ----

// Recursively collect all .html files in a directory
function collectHtmlFiles(username, dirPath) {
  const results = [];
  const fullPath = fileService.getSafePath(username, dirPath || '');
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subPath = dirPath ? path.join(dirPath, entry.name).replace(/\\/g, '/') : entry.name;
      results.push(...collectHtmlFiles(username, subPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const itemPath = dirPath ? path.join(dirPath, entry.name).replace(/\\/g, '/') : entry.name;
      results.push(itemPath);
    }
  }
  return results;
}

// Extract the first <h2> text or <title> from HTML content for ToC
function extractTitle(content) {
  // Try first <h2>
  const h2Match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  if (h2Match) return h2Match[1].trim();
  // Try <title>
  const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  return 'Untitled';
}

// Remove margin split content (everything after <!-- MARGIN_SPLIT -->)
function stripMarginNotes(content) {
  const idx = content.indexOf('<!-- MARGIN_SPLIT -->');
  if (idx !== -1) {
    return content.substring(0, idx).trim();
  }
  return content;
}

// Convert [[wiki links]] to plain text
function resolveWikiLinks(content) {
  return content.replace(/\[\[([^\]]+)\]\]/g, '$1');
}

// Compile selected files into a Story Bible
function compileStoryBible(username, options) {
  const {
    files = [],
    folders = [],
    entireWorkspace = false,
    title = 'Story Bible',
    includeTableOfContents = true,
    includeSectionDividers = true,
    includeFilePaths = true,
    excludeMarginNotes = false,
    orderBy = 'folder', // 'folder', 'alphabetical', 'modified'
  } = options;

  // Collect all files to compile
  let allFiles = [];

  // Add explicit file list
  if (files.length > 0) {
    allFiles.push(...files);
  }

  // Add files from folders
  for (const folder of folders) {
    allFiles.push(...collectHtmlFiles(username, folder));
  }

  // Add all files from workspace
  if (entireWorkspace) {
    allFiles.push(...collectHtmlFiles(username, ''));
  }

  // Deduplicate
  const uniqueFiles = [...new Set(allFiles)];

  if (uniqueFiles.length === 0) {
    throw new Error('No files to compile. Select at least one file or folder.');
  }

  // Read all content
  const documents = uniqueFiles.map(filePath => {
    const content = fileService.readFile(username, filePath);
    const cleanContent = excludeMarginNotes ? stripMarginNotes(content) : content;
    const resolvedContent = resolveWikiLinks(cleanContent);
    const docTitle = extractTitle(cleanContent);
    const fullPath = fileService.getSafePath(username, filePath);
    const modified = fs.statSync(fullPath).mtime.getTime();
    return { filePath, content: resolvedContent, docTitle, modified };
  });

  // Sort by order
  if (orderBy === 'alphabetical') {
    documents.sort((a, b) => a.docTitle.localeCompare(b.docTitle));
  } else if (orderBy === 'modified') {
    documents.sort((a, b) => b.modified - a.modified);
  }
  // 'folder' is the default - maintain the order they were provided (which follows folder structure)

  // Build output
  let html = `<h1>${title}</h1>`;
  html += `<p><em>Compiled on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. ${documents.length} document${documents.length > 1 ? 's' : ''}.</em></p>`;

  // Generate Table of Contents
  if (includeTableOfContents) {
    html += `<nav class="story-bible-toc"><h2>Table of Contents</h2><ol>`;
    documents.forEach((doc, i) => {
      const anchor = `doc-${i}`;
      html += `<li><a href="#${anchor}">${doc.docTitle}</a></li>`;
    });
    html += `</ol></nav>`;
  }

  // Build document sections
  let currentFolder = '';
  documents.forEach((doc, i) => {
    const docFolder = path.dirname(doc.filePath).replace(/\\/g, '/');

    // Insert folder section header if folder changed and dividers enabled
    if (includeSectionDividers && docFolder !== currentFolder && currentFolder !== '') {
      html += `<hr class="story-bible-section">`;
    }
    if (includeSectionDividers && docFolder && docFolder !== currentFolder) {
      html += `<h2>${docFolder}</h2>`;
      currentFolder = docFolder;
    }

    html += `<div class="story-bible-document" id="doc-${i}">`;
    html += `<h3>${doc.docTitle}</h3>`;

    if (includeFilePaths) {
      html += `<p class="story-bible-path">${doc.filePath}</p>`;
    }

    html += doc.content;
    html += `</div>`;
  });

  return html;
}

export {
  getAvailableTemplates,
  createFromTemplate,
  compileStoryBible,
};
