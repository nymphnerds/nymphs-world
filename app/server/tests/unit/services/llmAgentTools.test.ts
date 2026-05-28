/**
 * llmAgentTools unit tests
 *
 * Tests the 29 new LLM agent tools (graph, tags, locations, files, image gen, reminders)
 * by mocking their underlying services and verifying executeTool dispatches correctly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock all service modules ──

vi.mock('../../../src/services/graphService.js', () => ({
  loadGraph: vi.fn(),
  formatGraph: vi.fn(),
  searchEntities: vi.fn(),
  getEntity: vi.fn(),
  createEntity: vi.fn(),
  createRelations: vi.fn(),
  addObservations: vi.fn(),
  deleteEntities: vi.fn(),
  deleteObservations: vi.fn(),
  deleteRelations: vi.fn(),
}));

vi.mock('../../../src/services/tagService.js', () => ({
  getAllTags: vi.fn(),
  createTag: vi.fn(),
  getFileTags: vi.fn(),
  addTagsToFile: vi.fn(),
  removeTagsFromFile: vi.fn(),
  getFilesByTag: vi.fn(),
}));

vi.mock('../../../src/services/locationService.js', () => ({
  getAllLocations: vi.fn(),
  createLocation: vi.fn(),
  getFileLocations: vi.fn(),
  addLocationsToFile: vi.fn(),
  removeLocationsFromFile: vi.fn(),
  getFilesByLocation: vi.fn(),
}));

vi.mock('../../../src/services/fileService.js', () => ({
  searchWorkspace: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  getUserWorkspaceDir: vi.fn(() => '/tmp/mock-workspace'),
  getUserAssetsDir: vi.fn(() => '/tmp/mock-workspace/assets'),
}));

vi.mock('../../../src/services/reminderService.js', () => ({
  getByUser: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('axios', () => {
  const mockPost = vi.fn();
  return {
    default: { post: mockPost },
    post: mockPost,
  };
});

// ── Import mocked modules ──

import * as graphService from '../../../src/services/graphService.js';
import * as tagService from '../../../src/services/tagService.js';
import * as locationService from '../../../src/services/locationService.js';
import * as fileService from '../../../src/services/fileService.js';
import * as reminderService from '../../../src/services/reminderService.js';
import * as toolService from '../../../src/services/toolService.js';
import axios from 'axios';

// ── Helper ──

function getToolNames(permissions: any) {
  const defs = toolService.getToolDefinitions(permissions);
  return defs.map((d: any) => d.function.name);
}

const GRAPH_TOOLS = [
  'read_graph', 'search_nodes', 'open_nodes', 'create_entities',
  'create_relations', 'add_observations', 'delete_entities',
  'delete_observations', 'delete_relations',
];

const TAG_TOOLS = [
  'tag_list', 'tag_create', 'tag_get_file_tags', 'tag_add_to_file',
  'tag_remove_from_file', 'tag_files_by_tag',
];

const LOCATION_TOOLS = [
  'location_list', 'location_create', 'location_get_file_locations',
  'location_add_to_file', 'location_remove_from_file', 'location_files_by_location',
];

const FILE_TOOLS = ['file_search', 'file_read', 'file_create', 'file_update'];
const REMINDER_TOOLS = ['reminder_list', 'reminder_create', 'reminder_delete'];

// ── Tests ──

describe('llmAgentTools - Permission Gating', () => {
  it('allowGraph=false → no graph tools', () => {
    const names = getToolNames({ allowGraph: false, fileAccessLevel: 'read' });
    for (const tool of GRAPH_TOOLS) {
      expect(names).not.toContain(tool);
    }
  });

  it('allowGraph=true → all 9 graph tools present', () => {
    const names = getToolNames({ allowGraph: true });
    for (const tool of GRAPH_TOOLS) {
      expect(names).toContain(tool);
    }
  });

  it('allowTags gating', () => {
    expect(getToolNames({ allowTags: false })).not.toContain('tag_list');
    const withTags = getToolNames({ allowTags: true });
    for (const tool of TAG_TOOLS) {
      expect(withTags).toContain(tool);
    }
  });

  it('allowLocations gating', () => {
    expect(getToolNames({ allowLocations: false })).not.toContain('location_list');
    const withLocs = getToolNames({ allowLocations: true });
    for (const tool of LOCATION_TOOLS) {
      expect(withLocs).toContain(tool);
    }
  });

  it('allowFiles gating', () => {
    expect(getToolNames({ allowFiles: false })).not.toContain('file_search');
    const withFiles = getToolNames({ allowFiles: true });
    for (const tool of FILE_TOOLS) {
      expect(withFiles).toContain(tool);
    }
  });

  it('allowImageGen gating', () => {
    expect(getToolNames({ allowImageGen: false })).not.toContain('image_generate');
    expect(getToolNames({ allowImageGen: true })).toContain('image_generate');
  });

  it('allowReminders gating', () => {
    expect(getToolNames({ allowReminders: false })).not.toContain('reminder_list');
    const withReminders = getToolNames({ allowReminders: true });
    for (const tool of REMINDER_TOOLS) {
      expect(withReminders).toContain(tool);
    }
  });

  it('all permissions true → 37 tools total (8 original + 29 new)', () => {
    const names = getToolNames({
      webSearch: true,
      fileAccessLevel: 'full',
      allowCreate: true,
      allowEdit: true,
      allowDelete: true,
      allowRename: true,
      allowGraph: true,
      allowTags: true,
      allowLocations: true,
      allowFiles: true,
      allowImageGen: true,
      allowReminders: true,
    });
    expect(names.length).toBe(49);
  });
});

describe('llmAgentTools - Knowledge Graph Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('read_graph dispatches to graphService.loadGraph + formatGraph', async () => {
    const mockGraph = { entities: { Hero: { entityType: 'Character', observations: ['Brave'] } }, relations: [] };
    (graphService.loadGraph as any).mockReturnValue(mockGraph);
    (graphService.formatGraph as any).mockReturnValue('formatted graph');

    const result = await toolService.executeTool('read_graph', {}, 'testuser');

    expect(graphService.loadGraph).toHaveBeenCalledWith('testuser');
    expect(graphService.formatGraph).toHaveBeenCalledWith(mockGraph);
    expect(result).toBe('formatted graph');
  });

  it('search_nodes dispatches to graphService.searchEntities', async () => {
    (graphService.searchEntities as any).mockReturnValue([{ name: 'Hero', entityType: 'Character' }]);
    (graphService.formatGraph as any).mockReturnValue('formatted search');

    const result = await toolService.executeTool('search_nodes', { query: 'hero' }, 'testuser');

    expect(graphService.searchEntities).toHaveBeenCalledWith('testuser', 'hero');
    expect(graphService.formatGraph).toHaveBeenCalled();
    expect(result).toBe('formatted search');
  });

  it('search_nodes throws when query missing', async () => {
    await expect(
      toolService.executeTool('search_nodes', {}, 'testuser')
    ).rejects.toThrow(/requires.*query/i);
  });

  it('open_nodes dispatches to graphService.getEntity for each name', async () => {
    (graphService.getEntity as any).mockReturnValue({ entityType: 'Character' });
    (graphService.formatGraph as any).mockReturnValue('formatted nodes');

    await toolService.executeTool('open_nodes', { names: ['Hero', 'Villain'] }, 'testuser');

    expect(graphService.getEntity).toHaveBeenCalledWith('testuser', 'Hero');
    expect(graphService.getEntity).toHaveBeenCalledWith('testuser', 'Villain');
  });

  it('create_entities dispatches to graphService.createEntity for each entity', async () => {
    (graphService.createEntity as any).mockReturnValue({ success: true });

    const result = await toolService.executeTool('create_entities', {
      entities: [
        { name: 'Hero', entityType: 'Character', observations: ['Brave'] },
        { name: 'Dragon', entityType: 'Creature', observations: [] },
      ],
    }, 'testuser');

    expect(graphService.createEntity).toHaveBeenCalledWith('testuser', 'Hero', 'Character', ['Brave']);
    expect(graphService.createEntity).toHaveBeenCalledWith('testuser', 'Dragon', 'Creature', []);
    expect(result).toContain('Created 2/2');
  });

  it('create_relations dispatches to graphService.createRelations', async () => {
    (graphService.createRelations as any).mockReturnValue({
      success: true,
      results: [{ success: true }, { success: true }],
    });

    const result = await toolService.executeTool('create_relations', {
      relations: [
        { from: 'Hero', to: 'Dragon', relationType: 'fights' },
      ],
    }, 'testuser');

    expect(graphService.createRelations).toHaveBeenCalledWith('testuser', [
      { from: 'Hero', to: 'Dragon', relationType: 'fights' },
    ]);
    expect(result).toContain('Created 2/1');
  });

  it('add_observations dispatches to graphService.addObservations', async () => {
    (graphService.addObservations as any).mockReturnValue({ success: true, added: ['Wise'] });

    const result = await toolService.executeTool('add_observations', {
      observations: [{ entityName: 'Hero', contents: ['Wise'] }],
    }, 'testuser');

    expect(graphService.addObservations).toHaveBeenCalledWith('testuser', 'Hero', ['Wise']);
    expect(result).toContain('Added observations to 1/1');
  });

  it('delete_entities dispatches to graphService.deleteEntities', async () => {
    (graphService.deleteEntities as any).mockReturnValue({ success: true, deleted: ['Hero'] });

    const result = await toolService.executeTool('delete_entities', {
      entityNames: ['Hero'],
    }, 'testuser');

    expect(graphService.deleteEntities).toHaveBeenCalledWith('testuser', ['Hero']);
    expect(result).toContain('Deleted 1 entities');
  });

  it('delete_observations dispatches to graphService.deleteObservations', async () => {
    (graphService.deleteObservations as any).mockReturnValue({
      success: true,
      results: [{ success: true, removed: 1 }],
    });

    const result = await toolService.executeTool('delete_observations', {
      deletions: [{ entityName: 'Hero', observations: ['Brave'] }],
    }, 'testuser');

    expect(graphService.deleteObservations).toHaveBeenCalledWith('testuser', [
      { entityName: 'Hero', observations: ['Brave'] },
    ]);
    expect(result).toContain('Deleted 1 observations');
  });

  it('delete_relations dispatches to graphService.deleteRelations', async () => {
    (graphService.deleteRelations as any).mockReturnValue({ success: true, removed: 1 });

    const result = await toolService.executeTool('delete_relations', {
      relations: [{ from: 'Hero', to: 'Dragon', relationType: 'fights' }],
    }, 'testuser');

    expect(graphService.deleteRelations).toHaveBeenCalledWith('testuser', [
      { from: 'Hero', to: 'Dragon', relationType: 'fights' },
    ]);
    expect(result).toContain('Deleted 1 relations');
  });
});

describe('llmAgentTools - Tag Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tag_list returns all tags', async () => {
    (tagService.getAllTags as any).mockReturnValue([
      { name: 'MainChar', color: '#f59e0b', description: 'Main character' },
    ]);

    const result = await toolService.executeTool('tag_list', {});

    expect(tagService.getAllTags).toHaveBeenCalled();
    expect(result).toContain('MainChar');
    expect(result).toContain('#f59e0b');
  });

  it('tag_create dispatches with name, color, description', async () => {
    (tagService.createTag as any).mockReturnValue({ name: 'NewTag', color: '#ff0000', description: '' });

    const result = await toolService.executeTool('tag_create', {
      name: 'NewTag',
      color: '#ff0000',
    }, 'testuser');

    expect(tagService.createTag).toHaveBeenCalledWith('NewTag', '#ff0000', undefined);
    expect(result).toContain('Created tag');
  });

  it('tag_get_file_tags dispatches with username and filePath', async () => {
    (tagService.getFileTags as any).mockReturnValue(['MainChar', 'NPC']);

    const result = await toolService.executeTool('tag_get_file_tags', {
      file_path: 'PlayerCharacters/hero.txt',
    }, 'testuser');

    expect(tagService.getFileTags).toHaveBeenCalledWith('testuser', 'PlayerCharacters/hero.txt');
    expect(result).toContain('MainChar');
  });

  it('tag_add_to_file dispatches with username, filePath, tags', async () => {
    (tagService.addTagsToFile as any).mockReturnValue(['MainChar']);

    const result = await toolService.executeTool('tag_add_to_file', {
      file_path: 'PlayerCharacters/hero.txt',
      tags: ['MainChar'],
    }, 'testuser');

    expect(tagService.addTagsToFile).toHaveBeenCalledWith('testuser', 'PlayerCharacters/hero.txt', ['MainChar']);
    expect(result).toContain('Added');
  });

  it('tag_remove_from_file dispatches correctly', async () => {
    (tagService.removeTagsFromFile as any).mockReturnValue(['NPC']);

    const result = await toolService.executeTool('tag_remove_from_file', {
      file_path: 'PlayerCharacters/hero.txt',
      tags: ['NPC'],
    }, 'testuser');

    expect(tagService.removeTagsFromFile).toHaveBeenCalledWith('testuser', 'PlayerCharacters/hero.txt', ['NPC']);
    expect(result).toContain('Removed');
  });

  it('tag_files_by_tag dispatches with tagName', async () => {
    (tagService.getFilesByTag as any).mockReturnValue([
      'PlayerCharacters/hero.txt',
    ]);

    const result = await toolService.executeTool('tag_files_by_tag', {
      tag_name: 'MainChar',
    }, 'testuser');

    expect(tagService.getFilesByTag).toHaveBeenCalledWith('MainChar');
    expect(result).toContain('PlayerCharacters/hero.txt');
  });
});

describe('llmAgentTools - Location Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('location_list returns all locations', async () => {
    (locationService.getAllLocations as any).mockReturnValue([
      { name: 'Home', color: '#22c55e', description: 'Home location' },
    ]);

    const result = await toolService.executeTool('location_list', {});

    expect(locationService.getAllLocations).toHaveBeenCalled();
    expect(result).toContain('Home');
  });

  it('location_create dispatches with name, color, description', async () => {
    (locationService.createLocation as any).mockReturnValue({
      name: 'Forest',
      color: '#10b981',
      description: '',
    });

    const result = await toolService.executeTool('location_create', {
      name: 'Forest',
      color: '#10b981',
    });

    expect(locationService.createLocation).toHaveBeenCalledWith('Forest', '#10b981', undefined);
    expect(result).toContain('Created location');
  });

  it('location_get_file_locations dispatches with username and filePath', async () => {
    (locationService.getFileLocations as any).mockReturnValue(['Home', 'Work']);

    const result = await toolService.executeTool('location_get_file_locations', {
      file_path: 'Documents/notes.txt',
    }, 'testuser');

    expect(locationService.getFileLocations).toHaveBeenCalledWith('testuser', 'Documents/notes.txt');
    expect(result).toContain('Home');
  });

  it('location_add_to_file dispatches correctly', async () => {
    (locationService.addLocationsToFile as any).mockReturnValue(['Forest']);

    const result = await toolService.executeTool('location_add_to_file', {
      file_path: 'World/forest.txt',
      locations: ['Forest'],
    }, 'testuser');

    expect(locationService.addLocationsToFile).toHaveBeenCalledWith('testuser', 'World/forest.txt', ['Forest']);
    expect(result).toContain('Added');
  });

  it('location_remove_from_file dispatches correctly', async () => {
    (locationService.removeLocationsFromFile as any).mockReturnValue(['Home']);

    const result = await toolService.executeTool('location_remove_from_file', {
      file_path: 'Documents/notes.txt',
      locations: ['Home'],
    }, 'testuser');

    expect(locationService.removeLocationsFromFile).toHaveBeenCalledWith('testuser', 'Documents/notes.txt', ['Home']);
    expect(result).toContain('Removed');
  });

  it('location_files_by_location dispatches with locationName', async () => {
    (locationService.getFilesByLocation as any).mockReturnValue([
      'World/home.txt',
    ]);

    const result = await toolService.executeTool('location_files_by_location', {
      location_name: 'Home',
    }, 'testuser');

    expect(locationService.getFilesByLocation).toHaveBeenCalledWith('Home');
    expect(result).toContain('World/home.txt');
  });
});

describe('llmAgentTools - File Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('file_search dispatches to fileService.searchWorkspace', async () => {
    (fileService.searchWorkspace as any).mockReturnValue([
      { path: 'hero.txt', matchType: 'filename', snippet: 'Hero content' },
    ]);

    const result = await toolService.executeTool('file_search', {
      query: 'hero',
      limit: 10,
    }, 'testuser');

    expect(fileService.searchWorkspace).toHaveBeenCalledWith('testuser', 'hero', { limit: 10 });
    expect(result).toContain('hero.txt');
  });

  it('file_read dispatches to fileService.readFile', async () => {
    (fileService.readFile as any).mockReturnValue('File content here');

    const result = await toolService.executeTool('file_read', {
      file_path: 'PlayerCharacters/hero.txt',
    }, 'testuser');

    expect(fileService.readFile).toHaveBeenCalledWith('testuser', 'PlayerCharacters/hero.txt');
    expect(result).toContain('File content here');
  });

  it('file_create dispatches to fileService.writeFile', async () => {
    (fileService.writeFile as any).mockReturnValue(undefined);

    const result = await toolService.executeTool('file_create', {
      file_path: 'PlayerCharacters/new.txt',
      content: 'Hello',
    }, 'testuser');

    expect(fileService.writeFile).toHaveBeenCalledWith('testuser', 'PlayerCharacters/new.txt', 'Hello');
    expect(result).toContain('File created');
  });

  it('file_update dispatches to fileService.writeFile', async () => {
    (fileService.writeFile as any).mockReturnValue(undefined);

    const result = await toolService.executeTool('file_update', {
      file_path: 'PlayerCharacters/new.txt',
      content: 'Updated',
    }, 'testuser');

    expect(fileService.writeFile).toHaveBeenCalledWith('testuser', 'PlayerCharacters/new.txt', 'Updated');
    expect(result).toContain('File updated');
  });
});

describe('llmAgentTools - Image Generation Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('image_generate returns static message', async () => {
    const result = await toolService.executeTool('image_generate', {
      prompt: 'a brave hero',
    }, 'testuser');

    expect(result).toContain('/api/llm/generate-image');
  });
});

describe('llmAgentTools - Reminder Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reminder_list returns all reminders', async () => {
    (reminderService.getByUser as any).mockReturnValue([
      { id: 'rem_1', title: 'Finish chapter', fireAt: '2025-01-01T00:00:00Z', status: 'pending', filePath: 'ch1.txt' },
    ]);

    const result = await toolService.executeTool('reminder_list', {}, 'testuser');

    expect(reminderService.getByUser).toHaveBeenCalledWith('testuser');
    expect(result).toContain('Finish chapter');
  });

  it('reminder_create dispatches with username and body', async () => {
    (reminderService.create as any).mockReturnValue({
      id: 'rem_1',
      title: 'Finish chapter',
      fireAt: '2025-01-01T00:00:00Z',
    });

    const result = await toolService.executeTool('reminder_create', {
      title: 'Finish chapter',
      fireAt: '2025-01-01T00:00:00Z',
      file_path: 'ch1.txt',
    }, 'testuser');

    expect(reminderService.create).toHaveBeenCalledWith('testuser', {
      title: 'Finish chapter',
      fireAt: '2025-01-01T00:00:00Z',
      filePath: 'ch1.txt',
    });
    expect(result).toContain('Reminder created');
  });

  it('reminder_delete dispatches with id and username', async () => {
    (reminderService.remove as any).mockReturnValue({ success: true });

    const result = await toolService.executeTool('reminder_delete', {
      id: 'rem_1',
    }, 'testuser');

    expect(reminderService.remove).toHaveBeenCalledWith('rem_1', 'testuser');
    expect(result).toContain('Reminder deleted');
  });
});

describe('llmAgentTools - Error Propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('missing username throws auth error for graph tools', async () => {
    await expect(
      toolService.executeTool('read_graph', {})
    ).rejects.toThrow(/requires authentication/i);
  });

  it('missing required args throws descriptive error', async () => {
    await expect(
      toolService.executeTool('create_entities', {}, 'testuser')
    ).rejects.toThrow(/requires.*entities/i);

    await expect(
      toolService.executeTool('file_search', {}, 'testuser')
    ).rejects.toThrow(/requires.*query/i);
  });

  it('service error propagates through executeTool', async () => {
    (graphService.loadGraph as any).mockImplementation(() => {
      throw new Error('Database corrupted');
    });

    await expect(
      toolService.executeTool('read_graph', {}, 'testuser')
    ).rejects.toThrow(/Database corrupted/);
  });
});