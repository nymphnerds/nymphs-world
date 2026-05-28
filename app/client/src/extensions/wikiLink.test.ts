import { describe, it, expect } from 'vitest';
import { parseWikiLinkText, wikiLinkRegex } from './wiki-link';

describe('parseWikiLinkText', () => {
  it('parses [[Name]] into targetName and displayText', () => {
    const result = parseWikiLinkText('[[Name]]');
    expect(result).toEqual({ targetName: 'Name', displayText: 'Name' });
  });

  it('parses [[Name|Display]] into targetName and custom displayText', () => {
    const result = parseWikiLinkText('[[Name|Display]]');
    expect(result).toEqual({ targetName: 'Name', displayText: 'Display' });
  });

  it('returns null for text without brackets', () => {
    const result = parseWikiLinkText('no brackets here');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseWikiLinkText('');
    expect(result).toBeNull();
  });

  it('trims whitespace from targetName and displayText', () => {
    const result = parseWikiLinkText('[[ Name | Display ]]');
    expect(result).toEqual({ targetName: 'Name', displayText: 'Display' });
  });
});

describe('wikiLinkRegex', () => {
  it('matches multiple wiki-links in text', () => {
    const text = 'Hello [[Alice]] and [[Bob|Robert]], welcome!';
    const matches = [...text.matchAll(wikiLinkRegex)];
    expect(matches).toHaveLength(2);
    expect(matches[0][1]).toBe('Alice');
    expect(matches[1][1]).toBe('Bob');
    expect(matches[1][2]).toBe('Robert');
  });

  it('does not match incomplete brackets', () => {
    const text = 'Hello [[Alice and Bob]';
    const matches = [...text.matchAll(wikiLinkRegex)];
    expect(matches).toHaveLength(0);
  });
});