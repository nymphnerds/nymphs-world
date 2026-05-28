import { describe, it, expect } from 'vitest';
import {
  detectTemplateType,
  getAllTemplateTypes,
  getTemplateTypeById,
  buildGameReadyPath,
  isGameReadyFolder,
  isGameReadyFile,
  GENERATOR_TYPES,
  AGGREGATOR_TYPE,
} from './templateDetector';

describe('detectTemplateType', () => {
  it('detects NPC template from NPCs folder', () => {
    const result = detectTemplateType('NPCs');
    expect(result).not.toBeNull();
    expect(result!.label).toBe('NPC Character');
  });

  it('detects Quest template from Quests folder', () => {
    const result = detectTemplateType('Quests');
    expect(result).not.toBeNull();
    expect(result!.label).toBe('Quest Arc');
  });

  it('detects Location template from Locations folder', () => {
    const result = detectTemplateType('Locations');
    expect(result).not.toBeNull();
    expect(result!.label).toBe('Location');
  });

  it('detects template from nested path using top-level folder', () => {
    const result = detectTemplateType('NPCs/character_name');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('npc');
  });

  it('returns null for unrecognized folders', () => {
    const result = detectTemplateType('RandomFolder');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = detectTemplateType('');
    expect(result).toBeNull();
  });
});

describe('getAllTemplateTypes', () => {
  it('returns all template configurations', () => {
    const types = getAllTemplateTypes();
    expect(types.length).toBeGreaterThanOrEqual(6);
  });
});

describe('getTemplateTypeById', () => {
  it('returns config by ID', () => {
    const config = getTemplateTypeById('npc');
    expect(config).toBeDefined();
    expect(config!.label).toBe('NPC Character');
  });

  it('returns undefined for unknown ID', () => {
    const config = getTemplateTypeById('nonexistent');
    expect(config).toBeUndefined();
  });
});

describe('buildGameReadyPath', () => {
  it('builds correct output path', () => {
    const npc = detectTemplateType('NPCs')!;
    const path = buildGameReadyPath(npc, 'hero_name');
    expect(path).toBe('GameReady/NPCs/hero_name.txt');
  });
});

describe('isGameReadyFolder', () => {
  it('returns true for GameReady folder', () => {
    expect(isGameReadyFolder('GameReady')).toBe(true);
    expect(isGameReadyFolder('GameReady/NPCs')).toBe(true);
  });

  it('returns false for non-GameReady folders', () => {
    expect(isGameReadyFolder('NPCs')).toBe(false);
    expect(isGameReadyFolder('')).toBe(false);
  });
});

describe('isGameReadyFile', () => {
  it('returns true for GameReady file paths', () => {
    expect(isGameReadyFile('GameReady/NPCs/hero.txt')).toBe(true);
  });

  it('returns false for regular file paths', () => {
    expect(isGameReadyFile('NPCs/hero.txt')).toBe(false);
    expect(isGameReadyFile('')).toBe(false);
  });
});

describe('GENERATOR_TYPES', () => {
  it('excludes aggregator types', () => {
    expect(GENERATOR_TYPES).not.toContain(AGGREGATOR_TYPE);
  });
});