import { describe, it, expect } from 'vitest';
import {
  parseStoryMetadata,
  isStoryFile,
  detectTemplateFromContent,
  autoDetectTemplateCandidate,
  addBuildMetadata,
  removeBuildMetadata,
} from './storyFileDetector';

describe('parseStoryMetadata', () => {
  it('detects Build: Yes from HTML comment', () => {
    const content = '<!-- Build: Yes -->\n<!-- Template: Character -->\nSome content';
    const result = parseStoryMetadata(content);
    expect(result.isIncluded).toBe(true);
    expect(result.templateType).toBe('Character');
  });

  it('detects missing Build marker', () => {
    const content = '<!-- Template: Quest -->\nSome content';
    const result = parseStoryMetadata(content);
    expect(result.isIncluded).toBe(false);
    expect(result.templateType).toBe('Quest');
  });

  it('handles content with no metadata', () => {
    const content = 'Just plain text content';
    const result = parseStoryMetadata(content);
    expect(result.isIncluded).toBe(false);
    expect(result.templateType).toBeNull();
  });
});

describe('isStoryFile', () => {
  it('returns true for files with Build: Yes', () => {
    const content = '<!-- Build: Yes -->\n<!-- Template: Location -->';
    expect(isStoryFile(content)).toBe(true);
  });

  it('returns false for files without Build marker', () => {
    const content = '<!-- Template: Location -->\nNo build marker';
    expect(isStoryFile(content)).toBe(false);
  });
});

describe('detectTemplateFromContent', () => {
  it('extracts template type from metadata', () => {
    const content = '<!-- Build: Yes -->\n<!-- Template: Faction -->';
    expect(detectTemplateFromContent(content)).toBe('Faction');
  });

  it('returns null when no template metadata present', () => {
    const content = 'No metadata here';
    expect(detectTemplateFromContent(content)).toBeNull();
  });
});

describe('autoDetectTemplateCandidate', () => {
  it('identifies candidate in template folder with section blocks', () => {
    const content = '[Appearance] A tall warrior\n[Personality] Brave';
    const result = autoDetectTemplateCandidate(content, 'NPCs/hero.txt');
    expect(result.isCandidate).toBe(true);
    expect(result.detectedTemplateType).not.toBeNull();
  });

  it('rejects already confirmed files', () => {
    const content = '<!-- Build: Yes -->\n<!-- Template: Character -->\n[Section]';
    const result = autoDetectTemplateCandidate(content, 'NPCs/hero.txt');
    expect(result.isCandidate).toBe(false);
    expect(result.reason).toBe('Already marked for build');
  });

  it('rejects files outside template folders', () => {
    const content = '[Section] content';
    const result = autoDetectTemplateCandidate(content, 'RandomFolder/file.txt');
    expect(result.isCandidate).toBe(false);
  });
});

describe('addBuildMetadata', () => {
  it('prepends Build and Template metadata', () => {
    const content = 'Some existing content';
    const result = addBuildMetadata(content, 'Character');
    expect(result).toContain('<!-- Build: Yes -->');
    expect(result).toContain('<!-- Template: Character -->');
    expect(result).toContain('Some existing content');
  });

  it('does not duplicate existing metadata', () => {
    const content = '<!-- Build: Yes -->\n<!-- Template: Character -->\nContent';
    const result = addBuildMetadata(content, 'Character');
    expect(result.split('Build').length - 1).toBe(1); // Only one Build line
  });
});

describe('removeBuildMetadata', () => {
  it('removes Build: Yes comment', () => {
    const content = '<!-- Build: Yes -->\n<!-- Template: Character -->\nContent';
    const result = removeBuildMetadata(content);
    expect(result).not.toContain('Build:');
    expect(result).toContain('<!-- Template: Character -->');
    expect(result).toContain('Content');
  });
});