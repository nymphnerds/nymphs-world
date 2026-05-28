import { describe, expect, it } from 'vitest';
import {
  buildExportCandidate,
  detectTemplateName,
  isBuildEnabled,
  resolveTemplateType,
} from './gameExportConverter';

const npcHtml = `<!-- Build: Yes -->
<!-- Template: Character -->
<h2>Character</h2>
<p><strong>Name:</strong> Jagga</p>
<p><strong>Role:</strong> Unstable Magic User</p>
<p><strong>Personality:</strong> Optimistic, resilient</p>
<p><strong>Location:</strong> Antichamber</p>
<p><strong>Status:</strong> Active</p>
<h3>Backstory</h3>
<p>Jagga is trying to get home.</p>
<h3>Relationships</h3>
<p>NPC: - Frank (same species)</p>`;

describe('gameExportConverter', () => {
  it('detects build and template metadata from WORBI comments', () => {
    expect(isBuildEnabled(npcHtml)).toBe(true);
    expect(detectTemplateName(npcHtml)).toBe('Character');
  });

  it('routes PlayerCharacters to PlayerCharacter GameReady output', () => {
    const template = resolveTemplateType('PlayerCharacters/Hack.html', npcHtml);

    expect(template?.id).toBe('playerCharacter');
    expect(template?.outputSubfolder).toBe('PlayerCharacter');
  });

  it('exports buildable NPC HTML to deterministic TXT', () => {
    const candidate = buildExportCandidate('NPCs/Jagga.html', npcHtml);

    expect('reason' in candidate).toBe(false);
    if ('reason' in candidate) return;

    expect(candidate.outputPath).toBe('GameReady/NPCs/Jagga.txt');
    expect(candidate.content).toContain('Name: Jagga');
    expect(candidate.content).toContain('NPCType: Character');
    expect(candidate.content).toContain('[Backstory]');
    expect(candidate.content).toContain('NPC: Frank (same species)');
  });

  it('skips documents without Build: Yes', () => {
    const candidate = buildExportCandidate('NPCs/Draft.html', npcHtml.replace('Build: Yes', 'Build: No'));

    expect('reason' in candidate).toBe(true);
    if (!('reason' in candidate)) return;

    expect(candidate.reason).toBe('Build flag is set to No');
  });

  it('does not export blank template documents as folder-derived NPCs', () => {
    const candidate = buildExportCandidate('NPCs/Notes.html', '<!-- Build: Yes -->\n<!-- Template: Blank -->\n<p>Scratch notes</p>');

    expect('reason' in candidate).toBe(true);
    if (!('reason' in candidate)) return;

    expect(candidate.reason).toBe('Template type is not exportable');
  });
});
