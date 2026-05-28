import { describe, it, expect } from 'vitest';
import {
  getFolderFromPath,
  getFileName,
  stripHtmlExtension,
  getDisplayName,
} from './filePathUtils';

describe('getFolderFromPath', () => {
  it('extracts single-level folder from path', () => {
    expect(getFolderFromPath('NPCs/JimmyDog.html')).toBe('NPCs');
  });

  it('extracts nested folder path', () => {
    expect(getFolderFromPath('Quests/Acts/Act1.html')).toBe('Quests/Acts');
  });

  it('returns empty string for root-level files', () => {
    expect(getFolderFromPath('rootFile.html')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(getFolderFromPath('')).toBe('');
  });

  it('returns empty string for files with dots but no folder', () => {
    expect(getFolderFromPath('my.file.txt')).toBe('');
  });

  it('handles deeply nested paths', () => {
    expect(getFolderFromPath('a/b/c/d/file.html')).toBe('a/b/c/d');
  });

  it('preserves trailing content in folder name', () => {
    expect(getFolderFromPath('Player Characters/hero.html')).toBe('Player Characters');
  });

  it('handles paths with multiple dots in filename', () => {
    expect(getFolderFromPath('NPCs/jimmy.dog.v2.html')).toBe('NPCs');
  });
});

describe('getFileName', () => {
  it('extracts filename from single-level path', () => {
    expect(getFileName('NPCs/JimmyDog.html')).toBe('JimmyDog.html');
  });

  it('extracts filename from nested path', () => {
    expect(getFileName('Quests/Acts/Act1.html')).toBe('Act1.html');
  });

  it('returns full path when no folder', () => {
    expect(getFileName('rootFile.html')).toBe('rootFile.html');
  });

  it('returns empty string for empty input', () => {
    expect(getFileName('')).toBe('');
  });

  it('handles files with dots in name', () => {
    expect(getFileName('NPCs/jimmy.dog.html')).toBe('jimmy.dog.html');
  });

  it('preserves file extension', () => {
    expect(getFileName('docs/notes.txt')).toBe('notes.txt');
  });
});

describe('stripHtmlExtension', () => {
  it('removes lowercase .html extension', () => {
    expect(stripHtmlExtension('JimmyDog.html')).toBe('JimmyDog');
  });

  it('removes uppercase .HTML extension', () => {
    expect(stripHtmlExtension('JimmyDog.HTML')).toBe('JimmyDog');
  });

  it('removes mixed-case .Html extension', () => {
    expect(stripHtmlExtension('JimmyDog.Html')).toBe('JimmyDog');
  });

  it('leaves non-html extensions alone', () => {
    expect(stripHtmlExtension('notes.txt')).toBe('notes.txt');
  });

  it('leaves filenames without extension alone', () => {
    expect(stripHtmlExtension('README')).toBe('README');
  });

  it('handles empty string', () => {
    expect(stripHtmlExtension('')).toBe('');
  });

  it('does not strip .html in the middle of filename', () => {
    expect(stripHtmlExtension('my.html.file')).toBe('my.html.file');
  });

  it('handles filename ending with .htmlx (not .html)', () => {
    expect(stripHtmlExtension('file.htmlx')).toBe('file.htmlx');
  });
});

describe('getDisplayName', () => {
  it('extracts clean name from foldered path', () => {
    expect(getDisplayName('NPCs/JimmyDog.html')).toBe('JimmyDog');
  });

  it('extracts clean name from nested path', () => {
    expect(getDisplayName('Quests/Acts/Act1.html')).toBe('Act1');
  });

  it('extracts clean name from root file', () => {
    expect(getDisplayName('myFile.html')).toBe('myFile');
  });

  it('handles files with dots in name', () => {
    expect(getDisplayName('NPCs/jimmy.dog.v2.html')).toBe('jimmy.dog.v2');
  });

  it('handles empty input', () => {
    expect(getDisplayName('')).toBe('');
  });

  it('preserves non-html extension', () => {
    expect(getDisplayName('docs/notes.txt')).toBe('notes.txt');
  });
});