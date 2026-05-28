import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock authService BEFORE importing timeline route
vi.mock('../../../../src/services/authService.js', () => ({
  getUserWorkspaceDir: vi.fn(() => '/tmp/mock-workspace'),
}));

vi.mock('../../../../src/services/tagService.js', () => ({
  getFileTags: vi.fn(() => []),
  getAllTags: vi.fn(() => []),
}));

// ---- Helper: create temp workspace with sample timeline files ----

function createTempWorkspace(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worbi-timeline-test-'));
  return tempRoot;
}

function cleanupTempWorkspace(tempRoot: string): void {
  if (tempRoot && fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function createHtmlFile(root: string, relPath: string, content: string): void {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

// HTML template with Date/Period and Era metadata
function makeTimelineHtml(date: string, era: string, snippet: string = 'Some description'): string {
  return `<!-- Build: Yes -->
<!-- Template: Timeline -->
<h2>Test Event</h2>
<p><strong>Date/Period:</strong> ${date}</p>
<p><strong>Era:</strong> ${era}</p>
<h3></h3>
<p>${snippet}</p>`;
}

describe('timeline.js — parseTimelineEntry()', () => {
  // We test the logic by simulating what parseTimelineEntry does
  // (it's a non-exported function, so we replicate its behavior)

  function parseTimelineEntry(content: string, filePath: string): any {
    const result = {
    name: '',
    path: filePath,
    date: '',
    era: '',
    isApproximate: false,
    dateSortable: null as number | null,
    snippet: '',
    };

    const dateMatch = content.match(/<p><strong>Date\/Period:<\/strong>\s*(.*?)\s*<\/p>/i);
    if (dateMatch) {
      result.date = dateMatch[1].replace(/<[^>]*>/g, '').trim();
      result.isApproximate = result.date.includes('~') || result.date.toLowerCase().includes('approx');
    }

    const eraMatch = content.match(/<p><strong>Era:<\/strong>\s*(.*?)\s*<\/p>/i);
    if (eraMatch) {
      result.era = eraMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // v6.3.10: use filename without extension as display name
    result.name = path.basename(filePath, '.html');

    const snippetMatch = content.match(/<h3><\/h3>\s*<p>(.*?)<\/p>/i);
    if (!snippetMatch) {
      const pMatch = content.match(/<p>(.*?)<\/p>/i);
      if (pMatch) {
        result.snippet = pMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 100);
      }
    } else {
      result.snippet = snippetMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 100);
    }

    // Extract sortable number
    const dateStr = result.date;
    if (dateStr) {
      const yearMatch = dateStr.match(/(\d{4,6})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1], 10);
        if (dateStr.toLowerCase().includes('bce') || dateStr.toLowerCase().includes(' bc')) {
          result.dateSortable = -year;
        } else {
          result.dateSortable = year;
        }
      } else {
        const numMatch = dateStr.match(/(\d{2,6})/);
        if (numMatch) {
          result.dateSortable = parseInt(numMatch[1], 10);
        }
      }
    }

    return result;
  }

  it('uses filename (without .html) as display name — NOT <h2> content', () => {
    const html = `<h2>Hero Arrives in Village</h2>
<p><strong>Date/Period:</strong> 1200</p>
<p><strong>Era:</strong> First Age</p>`;

    const entry = parseTimelineEntry(html, 'World/Timeline/hero_arrives.html');

    // v6.3.10 change: name should be the filename, not the <h2> text
    expect(entry.name).toBe('hero_arrives');
    expect(entry.name).not.toBe('Hero Arrives in Village');
  });

  it('extracts Date/Period from HTML content', () => {
    const html = makeTimelineHtml('1200', 'First Age');
    const entry = parseTimelineEntry(html, 'World/Timeline/event.html');

    expect(entry.date).toBe('1200');
  });

  it('extracts Era from HTML content', () => {
    const html = makeTimelineHtml('1200', 'Third Age');
    const entry = parseTimelineEntry(html, 'World/Timeline/event.html');

    expect(entry.era).toBe('Third Age');
  });

  it('detects approximate dates with ~ prefix', () => {
    const html = makeTimelineHtml('~1200', 'First Age');
    const entry = parseTimelineEntry(html, 'World/Timeline/event.html');

    expect(entry.isApproximate).toBe(true);
    expect(entry.date).toBe('~1200');
  });

  it('detects approximate dates with "approx" keyword', () => {
    const html = makeTimelineHtml('approx 1200', 'First Age');
    const entry = parseTimelineEntry(html, 'World/Timeline/event.html');

    expect(entry.isApproximate).toBe(true);
  });

  it('sets isApproximate to false for exact dates', () => {
    const html = makeTimelineHtml('1200', 'First Age');
    const entry = parseTimelineEntry(html, 'World/Timeline/event.html');

    expect(entry.isApproximate).toBe(false);
  });

  it('extracts snippet from <h3></h3><p>...</p> pattern', () => {
    const html = `<h3></h3><p>This is the first real paragraph.</p>`;
    const entry = parseTimelineEntry(html, 'event.html');

    expect(entry.snippet).toContain('first real paragraph');
  });

  it('falls back to first <p> for snippet when no <h3></h3> pattern', () => {
    const html = `<p><strong>Era:</strong> First Age</p><p>Some story text here.</p>`;
    const entry = parseTimelineEntry(html, 'event.html');

    // The first <p> match is the Era line (since we match <p>...), but it includes the strong tag
    // In reality the regex strips tags. The snippet should be from the first <p> match.
    expect(entry.snippet.length).toBeGreaterThan(0);
  });

  it('handles missing Date/Period gracefully', () => {
    const html = `<p><strong>Era:</strong> First Age</p>`;
    const entry = parseTimelineEntry(html, 'event.html');

    expect(entry.date).toBe('');
    expect(entry.dateSortable).toBe(null);
  });

  it('handles missing Era gracefully', () => {
    const html = `<p><strong>Date/Period:</strong> 1200</p>`;
    const entry = parseTimelineEntry(html, 'event.html');

    expect(entry.era).toBe('');
  });

  it('strips .html extension from filename display name', () => {
    const html = makeTimelineHtml('1200', 'First Age');
    const entry = parseTimelineEntry(html, 'World/Timeline/my_event.html');

    expect(entry.name).toBe('my_event');
    expect(entry.name).not.toContain('.html');
  });

  it('preserves full relative path in entry.path', () => {
    const html = makeTimelineHtml('1200', 'First Age');
    const entry = parseTimelineEntry(html, 'World/Timeline/my_event.html');

    expect(entry.path).toBe('World/Timeline/my_event.html');
  });
});

describe('timeline.js — extractSortableDate()', () => {
  function extractSortableDate(dateStr: string): number | null {
    if (!dateStr) return null;

    const yearMatch = dateStr.match(/(\d{4,6})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (dateStr.toLowerCase().includes('bce') || dateStr.toLowerCase().includes(' bc')) {
        return -year;
      }
      return year;
    }

    const numMatch = dateStr.match(/(\d{2,6})/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }

    return null;
  }

  it('extracts 4-digit year', () => {
    expect(extractSortableDate('1200')).toBe(1200);
    expect(extractSortableDate('3A 1247')).toBe(1247);
    expect(extractSortableDate('Year 3456 of the Age')).toBe(3456);
  });

  it('handles BCE/BC as negative years (4+ digit years only)', () => {
    // The server code only checks BCE/BC for 4-6 digit matches
    expect(extractSortableDate('1452 BCE')).toBe(-1452);
    expect(extractSortableDate('2000 BC')).toBe(-2000);
    // Short numbers (2-3 digits) fall through to the generic \d{2,6} match which does NOT check BCE/BC
    expect(extractSortableDate('500 BC')).toBe(500);
  });

  it('handles short numeric dates', () => {
    expect(extractSortableDate('42')).toBe(42);
    expect(extractSortableDate('999')).toBe(999);
  });

  it('returns null for non-numeric dates', () => {
    expect(extractSortableDate('Ancient Times')).toBe(null);
    expect(extractSortableDate('Before the Fall')).toBe(null);
    expect(extractSortableDate('')).toBe(null);
    expect(extractSortableDate(null as any)).toBe(null);
  });

  it('handles approximate dates with ~', () => {
    expect(extractSortableDate('~1200')).toBe(1200);
  });
});

describe('timeline.js — walkDir / isScannableFile()', () => {
  function isScannableFile(filename: string): boolean {
    if (filename.startsWith('.')) return false;
    const binaryExts = new Set([
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico',
      'pdf', 'zip', 'tar', 'gz', 'rar', '7z',
      'mp3', 'mp4', 'avi', 'mov', 'wmv',
      'exe', 'dll', 'so', 'dylib',
      'docx', 'xlsx', 'pptx',
    ]);
    const ext = path.extname(filename).toLowerCase().slice(1);
    if (binaryExts.has(ext)) return false;
    return true;
  }

  it('includes .html files', () => {
    expect(isScannableFile('event.html')).toBe(true);
  });

  it('includes .txt files', () => {
    expect(isScannableFile('notes.txt')).toBe(true);
  });

  it('skips dotfiles', () => {
    expect(isScannableFile('.wbu_timeline_metadata.json')).toBe(false);
    expect(isScannableFile('.gitignore')).toBe(false);
  });

  it('skips binary image extensions', () => {
    expect(isScannableFile('photo.jpg')).toBe(false);
    expect(isScannableFile('photo.png')).toBe(false);
    expect(isScannableFile('photo.svg')).toBe(false);
  });

  it('skips binary document extensions', () => {
    expect(isScannableFile('doc.docx')).toBe(false);
    expect(isScannableFile('sheet.xlsx')).toBe(false);
    expect(isScannableFile('slides.pptx')).toBe(false);
    expect(isScannableFile('file.pdf')).toBe(false);
  });

  it('skips archive and media extensions', () => {
    expect(isScannableFile('archive.zip')).toBe(false);
    expect(isScannableFile('video.mp4')).toBe(false);
  });
});

describe('timeline.js — suggest-date logic', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(tempRoot);
    vi.clearAllMocks();
  });

  function extractSortableDate(dateStr: string): number | null {
    if (!dateStr) return null;
    const yearMatch = dateStr.match(/(\d{4,6})/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (dateStr.toLowerCase().includes('bce') || dateStr.toLowerCase().includes(' bc')) {
        return -year;
      }
      return year;
    }
    const numMatch = dateStr.match(/(\d{2,6})/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }
    return null;
  }

  function parseTimelineEntry(content: string, filePath: string): any {
    const result = {
      name: '', path: filePath, date: '', era: '',
      isApproximate: false, dateSortable: null as number | null, snippet: '',
    };
    const dateMatch = content.match(/<p><strong>Date\/Period:<\/strong>\s*(.*?)\s*<\/p>/i);
    if (dateMatch) {
      result.date = dateMatch[1].replace(/<[^>]*>/g, '').trim();
      result.isApproximate = result.date.includes('~') || result.date.toLowerCase().includes('approx');
    }
    const eraMatch = content.match(/<p><strong>Era:<\/strong>\s*(.*?)\s*<\/p>/i);
    if (eraMatch) {
      result.era = eraMatch[1].replace(/<[^>]*>/g, '').trim();
    }
    result.name = path.basename(filePath, '.html');
    result.dateSortable = extractSortableDate(result.date);
    return result;
  }

  function isScannableFile(filename: string): boolean {
    if (filename.startsWith('.')) return false;
    const binaryExts = new Set([
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico',
      'pdf', 'zip', 'tar', 'gz', 'rar', '7z',
      'mp3', 'mp4', 'avi', 'mov', 'wmv',
      'exe', 'dll', 'so', 'dylib',
      'docx', 'xlsx', 'pptx',
    ]);
    const ext = path.extname(filename).toLowerCase().slice(1);
    if (binaryExts.has(ext)) return false;
    return true;
  }

  // Simulate the suggest-date logic
  function suggestDate(era: string, files: Array<{ fullPath: string; relativePath: string }>): string {
    let maxDate: number | null = null;
    let countInEra = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file.fullPath, 'utf-8');
        const entry = parseTimelineEntry(content, file.relativePath);
        if (entry.era === era) {
          countInEra++;
          const num = extractSortableDate(entry.date);
          if (num !== null && (maxDate === null || num > maxDate)) {
            maxDate = num;
          }
        }
      } catch {
        // skip
      }
    }

    // v6.3.10: use max date + 1, fallback to count + 1
    return maxDate !== null ? String(maxDate + 1) : String(countInEra + 1);
  }

  function walkDir(dirPath: string, workspaceRoot: string, entries: any[] = []): any[] {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          walkDir(path.join(dirPath, item.name), workspaceRoot, entries);
        } else if (item.isFile() && isScannableFile(item.name)) {
          const fullPath = path.join(dirPath, item.name);
          const relativePath = path.relative(workspaceRoot, fullPath);
          entries.push({ fullPath, relativePath });
        }
      }
    } catch {
      // skip
    }
    return entries;
  }

  it('suggests max existing date + 1 for numeric dates (v6.3.10 fix)', () => {
    // Create 3 files in "First Age" with dates 1200, 1205, 1203
    createHtmlFile(tempRoot, 'World/Timeline/event1.html', makeTimelineHtml('1200', 'First Age'));
    createHtmlFile(tempRoot, 'World/Timeline/event2.html', makeTimelineHtml('1205', 'First Age'));
    createHtmlFile(tempRoot, 'World/Timeline/event3.html', makeTimelineHtml('1203', 'First Age'));

    const files = walkDir(tempRoot, tempRoot);
    const suggested = suggestDate('First Age', files);

    // v6.3.10: should be max(1200,1205,1203) + 1 = 1206, NOT count + 1 = 4
    expect(suggested).toBe('1206');
  });

  it('falls back to count + 1 for non-numeric dates', () => {
    createHtmlFile(tempRoot, 'World/Timeline/event1.html', makeTimelineHtml('Ancient Times', 'First Age'));
    createHtmlFile(tempRoot, 'World/Timeline/event2.html', makeTimelineHtml('Before the Fall', 'First Age'));

    const files = walkDir(tempRoot, tempRoot);
    const suggested = suggestDate('First Age', files);

    // No sortable dates, fallback to count + 1 = 3
    expect(suggested).toBe('3');
  });

  it('returns "1" when no files exist in the era', () => {
    createHtmlFile(tempRoot, 'World/Timeline/event.html', makeTimelineHtml('1200', 'Other Age'));

    const files = walkDir(tempRoot, tempRoot);
    const suggested = suggestDate('First Age', files);

    expect(suggested).toBe('1');
  });

  it('only counts files matching the selected era', () => {
    createHtmlFile(tempRoot, 'World/Timeline/event1.html', makeTimelineHtml('1200', 'First Age'));
    createHtmlFile(tempRoot, 'World/Timeline/event2.html', makeTimelineHtml('1300', 'Second Age'));

    const files = walkDir(tempRoot, tempRoot);

    expect(suggestDate('First Age', files)).toBe('1201');
    expect(suggestDate('Second Age', files)).toBe('1301');
  });
});

describe('timeline.js — era sorting logic', () => {
  const ERA_ORDER = [
    'First Age', 'Second Age', 'Third Age', 'Fourth Age', 'Future', 'Unknown'
  ];

  function sortEras(eraMap: Map<string, any[]>): any[] {
    const sortedEras: any[] = [];
    const unknownEras: any[] = [];

    for (const eraName of ERA_ORDER) {
      if (eraMap.has(eraName)) {
        sortedEras.push({ name: eraName, events: eraMap.get(eraName) });
        eraMap.delete(eraName);
      }
    }

    for (const [eraName, events] of eraMap) {
      unknownEras.push({ name: eraName, events });
    }
    unknownEras.sort((a, b) => a.name.localeCompare(b.name));

    sortedEras.push(...unknownEras);
    return sortedEras;
  }

  it('places configured eras in defined order', () => {
    const eraMap = new Map([
      ['Third Age', []],
      ['First Age', []],
      ['Second Age', []],
    ]);

    const result = sortEras(eraMap);
    expect(result.map((e) => e.name)).toEqual(['First Age', 'Second Age', 'Third Age']);
  });

  it('places custom eras alphabetically at the end', () => {
    const eraMap = new Map([
      ['First Age', []],
      ['My Custom Era', []],
      ['Zeta Age', []],
      ['Alpha Age', []],
    ]);

    const result = sortEras(eraMap);
    expect(result.map((e) => e.name)).toEqual(['First Age', 'Alpha Age', 'My Custom Era', 'Zeta Age']);
  });

  it('handles empty era map', () => {
    const eraMap = new Map<string, any[]>();
    const result = sortEras(eraMap);
    expect(result).toEqual([]);
  });
});

describe('timeline.js — event sorting within era', () => {
  function sortEvents(events: any[]): any[] {
    return [...events].sort((a, b) => {
      if (a.dateSortable !== null && b.dateSortable !== null) {
        return b.dateSortable - a.dateSortable;
      }
      if (a.dateSortable !== null) return -1;
      if (b.dateSortable !== null) return 1;
      if (a.date && b.date) {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
      }
      return a.name.localeCompare(b.name);
    });
  }

  it('sorts events by numeric date descending (most recent first)', () => {
    const events = [
      { name: 'Old', date: '1200', dateSortable: 1200 },
      { name: 'New', date: '1300', dateSortable: 1300 },
      { name: 'Middle', date: '1250', dateSortable: 1250 },
    ];

    const sorted = sortEvents(events);
    expect(sorted.map((e) => e.name)).toEqual(['New', 'Middle', 'Old']);
  });

  it('places sortable dates before non-sortable dates', () => {
    const events = [
      { name: 'NonNumeric', date: 'Ancient', dateSortable: null },
      { name: 'Numeric', date: '1200', dateSortable: 1200 },
    ];

    const sorted = sortEvents(events);
    expect(sorted[0].name).toBe('Numeric');
    expect(sorted[1].name).toBe('NonNumeric');
  });

  it('falls back to alphabetical sort for non-numeric dates', () => {
    const events = [
      { name: 'Zeta', date: 'Era Z', dateSortable: null },
      { name: 'Alpha', date: 'Era A', dateSortable: null },
    ];

    const sorted = sortEvents(events);
    expect(sorted.map((e) => e.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('falls back to name sort when dates are identical', () => {
    const events = [
      { name: 'Zebra', date: 'Ancient', dateSortable: null },
      { name: 'Apple', date: 'Ancient', dateSortable: null },
    ];

    const sorted = sortEvents(events);
    expect(sorted.map((e) => e.name)).toEqual(['Apple', 'Zebra']);
  });

  it('handles BCE dates (negative sortable) correctly', () => {
    const events = [
      { name: 'CE', date: '100', dateSortable: 100 },
      { name: 'BCE', date: '500 BCE', dateSortable: -500 },
    ];

    const sorted = sortEvents(events);
    // CE 100 should come first (more recent / higher number)
    expect(sorted[0].name).toBe('CE');
    expect(sorted[1].name).toBe('BCE');
  });
});

describe('timeline.js — metadata merge logic', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(tempRoot);
  });

  function loadTimelineMetadata(workspaceRoot: string): any {
    const metaPath = path.join(workspaceRoot, '.wbu_timeline_metadata.json');
    if (fs.existsSync(metaPath)) {
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch {
        return {};
      }
    }
    return {};
  }

  function saveTimelineMetadata(workspaceRoot: string, data: any): void {
    const metaPath = path.join(workspaceRoot, '.wbu_timeline_metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // Simulate the PUT /timeline/metadata merge logic
  function mergeMetadata(workspaceRoot: string, filePath: string, metadata: any): any {
    const all = loadTimelineMetadata(workspaceRoot);
    if (!all[filePath]) {
      all[filePath] = {};
    }
    for (const [key, value] of Object.entries(metadata)) {
      if (value === '') {
        delete all[filePath][key];
      } else {
        all[filePath][key] = value;
      }
    }
    if (Object.keys(all[filePath]).length === 0) {
      delete all[filePath];
    }
    saveTimelineMetadata(workspaceRoot, all);
    return all;
  }

  it('adds new metadata for a file', () => {
    const result = mergeMetadata(tempRoot, 'event.html', { date: '1200', era: 'First Age' });
    expect(result['event.html']).toEqual({ date: '1200', era: 'First Age' });
  });

  it('merges/updates existing metadata', () => {
    mergeMetadata(tempRoot, 'event.html', { date: '1200', era: 'First Age' });
    const result = mergeMetadata(tempRoot, 'event.html', { era: 'Second Age' });
    expect(result['event.html']).toEqual({ date: '1200', era: 'Second Age' });
  });

  it('deletes fields set to empty string', () => {
    mergeMetadata(tempRoot, 'event.html', { date: '1200', era: 'First Age' });
    const result = mergeMetadata(tempRoot, 'event.html', { date: '' });
    expect(result['event.html']).toEqual({ era: 'First Age' });
    expect(result['event.html']).not.toHaveProperty('date');
  });

  it('removes file entry when all fields are deleted', () => {
    mergeMetadata(tempRoot, 'event.html', { date: '1200' });
    const result = mergeMetadata(tempRoot, 'event.html', { date: '' });
    expect(result).not.toHaveProperty('event.html');
  });

  it('handles corrupt metadata JSON gracefully', () => {
    // Write invalid JSON
    const metaPath = path.join(tempRoot, '.wbu_timeline_metadata.json');
    fs.writeFileSync(metaPath, '{invalid json', 'utf-8');

    const data = loadTimelineMetadata(tempRoot);
    expect(data).toEqual({});
  });

  it('handles missing metadata file gracefully', () => {
    const data = loadTimelineMetadata(tempRoot);
    expect(data).toEqual({});
  });
});