import axios from 'axios';
import * as graphService from './graphService.js';
import * as tagService from './tagService.js';
import * as locationService from './locationService.js';
import * as fileService from './fileService.js';
import * as reminderService from './reminderService.js';

/**
 * Search the web using DuckDuckGo HTML endpoint.
 * Parses the HTML response to extract titles, URLs and snippets.
 */
async function webSearch(query, maxResults = 5) {
  try {
    const limit = Math.min(Math.max(1, maxResults), 20);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });

    const html = response.data;

    // Parse results from DuckDuckGo HTML
    const results = [];
    // Match result blocks: <a href="..."> followed by .result-snippet
    const resultRegex = /<a\s+href="([^"]+)"[^>]*class="result__a"[^>]*>([^<]+)<\/a>[\s\S]*?class="result-snippet"[^>]*>([^<]*)<\/div>/g;
    let match;

    while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
      let url = match[1];
      const title = match[2].trim();
      const snippet = match[3].trim();

      // DuckDuckGo uses redirect URLs, try to extract the actual URL
      if (url.startsWith('/')) {
        try {
          const redirectResp = await axios.get(`https://html.duckduckgo.com${url}`, {
            maxRedirects: 0,
            validateStatus: (status) => status === 302 || status === 303 || status === 200,
            headers: {
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            },
            timeout: 5000,
          }).catch(() => null);

          if (redirectResp && redirectResp.headers?.location) {
            url = redirectResp.headers.location;
          } else if (redirectResp && redirectResp.data) {
            // Try to extract URL from redirect page
            const urlMatch = redirectResp.data.match(/window\.location\.replace\(['"]([^'"]+)['"]\)/);
            if (urlMatch) url = urlMatch[1];
          }
        } catch {
          // Keep the DDG redirect URL
        }
      }

      results.push({ title, url, snippet });
    }

    // Fallback: simpler regex if the main one didn't match
    if (results.length === 0) {
      const simpleRegex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      const seenUrls = new Set();
      while ((match = simpleRegex.exec(html)) !== null && results.length < limit) {
        const url = match[1];
        const title = match[2].trim();
        if (url.startsWith('/') || title.length < 5 || seenUrls.has(url)) continue;
        seenUrls.add(url);
        // Only keep http(s) URLs
        if (url.startsWith('http')) {
          results.push({ title, url, snippet: '' });
        }
      }
    }

    if (results.length === 0) {
      return `No search results found for "${query}".`;
    }

    // Fetch the top result for more detail
    let detail = '';
    if (results[0]?.url && results[0].url.startsWith('http')) {
      try {
        const fetched = await fetchWebpage(results[0].url);
        if (fetched) {
          detail = `\n\n--- Content from "${results[0].url}" ---\n${fetched}`;
        }
      } catch {
        // Ignore fetch failures
      }
    }

    // Format results
    const formatted = results.map((r, i) => {
      return `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet || '(no snippet)'}`;
    }).join('\n\n');

    return `Search Results for "${query}":\n\n${formatted}${detail}`;
  } catch (error) {
    throw new Error(`Web search failed: ${error.message}`);
  }
}

/**
 * Fetch a webpage and convert it to clean text content.
 */
async function fetchWebpage(url, maxLength = 4000) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000,
      transformResponse: [(data) => data], // Keep raw HTML string
    });

    const html = response.data;

    // Strip HTML tags
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.substring(0, maxLength) + (text.length > maxLength ? '\n\n... (truncated)' : '');
  } catch (error) {
    return null;
  }
}

function requireUsername(username, toolName) {
  if (!username) {
    throw new Error(`${toolName} requires authentication`);
  }
  return username;
}

function requireStringArray(value, parameterName, toolName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${toolName} requires a "${parameterName}" array`);
  }
  const cleaned = value.map(item => String(item ?? '').trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error(`${toolName} requires at least one non-empty "${parameterName}" value`);
  }
  return cleaned;
}

function formatFileResults(files) {
  return files.map(file => {
    if (typeof file === 'string') return `- ${file}`;
    return `- ${file.path || file.name || JSON.stringify(file)}`;
  }).join('\n');
}

/**
 * Execute a tool by name. Used by llmService to dispatch tool calls.
 * @param {string} toolName - The tool to execute
 * @param {Object} arguments_obj - Tool arguments from LLM
 * @param {string} [username] - Optional username for user-scoped tools
 */
async function executeTool(toolName, arguments_obj, username) {
  const tools = {
    web_search: () => webSearch(arguments_obj?.query, arguments_obj?.max_results),

    // --- User-scoped File Tools (locked to user workspace via fileService) ---

    read: () => {
      if (!username) throw new Error('read requires authentication');
      const filePath = arguments_obj?.file_path;
      if (!filePath) throw new Error('read requires a "file_path" parameter');
      const content = fileService.readFile(username, filePath);
      return `Contents of "${filePath}":\n\n${content}`;
    },

    list: () => {
      if (!username) throw new Error('list requires authentication');
      const dirPath = arguments_obj?.dir_path || '';
      const items = fileService.listDirectory(username, dirPath);
      if (items.length === 0) return `Directory "${dirPath || '(root)'}" is empty.`;
      const lines = items.map(item =>
        `${item.type === 'folder' ? '\ud83d\udcc1' : '\ud83d\udcc4'} ${item.name}${item.size !== undefined ? ` (${(item.size / 1024).toFixed(1)}KB)` : ''}`
      );
      return `Directory listing for "${dirPath || '(root)'}":\n${lines.join('\n')}`;
    },

    write: () => {
      if (!username) throw new Error('write requires authentication');
      const filePath = arguments_obj?.file_path;
      const content = arguments_obj?.content;
      if (!filePath) throw new Error('write requires a "file_path" parameter');
      if (typeof content !== 'string') throw new Error('write requires a "content" parameter');
      fileService.writeFile(username, filePath, content);
      return `File created: ${filePath}`;
    },

    edit: () => {
      if (!username) throw new Error('edit requires authentication');
      const filePath = arguments_obj?.file_path;
      const content = arguments_obj?.content;
      if (!filePath) throw new Error('edit requires a "file_path" parameter');
      if (typeof content !== 'string') throw new Error('edit requires a "content" parameter');
      fileService.writeFile(username, filePath, content);
      return `File updated: ${filePath}`;
    },

    delete: () => {
      if (!username) throw new Error('delete requires authentication');
      const filePath = arguments_obj?.file_path;
      if (!filePath) throw new Error('delete requires a "file_path" parameter');
      fileService.deleteItem(username, filePath);
      return `Deleted: ${filePath}`;
    },

    rename: () => {
      if (!username) throw new Error('rename requires authentication');
      const filePath = arguments_obj?.file_path;
      const newName = arguments_obj?.new_name;
      if (!filePath) throw new Error('rename requires a "file_path" parameter');
      if (!newName) throw new Error('rename requires a "new_name" parameter');
      fileService.renameItem(username, filePath, newName);
      return `Renamed: ${filePath} → ${newName}`;
    },

    copy: () => {
      if (!username) throw new Error('copy requires authentication');
      const filePath = arguments_obj?.file_path;
      const destFolder = arguments_obj?.dest_folder;
      if (!filePath) throw new Error('copy requires a "file_path" parameter');
      const result = fileService.copyItem(username, filePath, destFolder);
      return `Copied: ${filePath} → ${result.destPath}`;
    },

    move: () => {
      if (!username) throw new Error('move requires authentication');
      const filePath = arguments_obj?.file_path;
      const destFolder = arguments_obj?.dest_folder;
      if (!filePath) throw new Error('move requires a "file_path" parameter');
      if (!destFolder) throw new Error('move requires a "dest_folder" parameter');
      const result = fileService.moveItem(username, filePath, destFolder);
      return `Moved: ${filePath} → ${result.destPath}`;
    },

    search: () => {
      if (!username) throw new Error('search requires authentication');
      const query = arguments_obj?.query;
      const limit = arguments_obj?.limit || 50;
      if (!query) throw new Error('search requires a "query" parameter');
      const results = fileService.searchWorkspace(username, query, { limit });
      if (results.length === 0) return `No files matching "${query}".`;
      const lines = results.slice(0, 20).map(r =>
        `- ${r.path}${r.matchType === 'filename' ? ' (filename match)' : ' (content match)'}\n  ${r.snippet || ''}`
      );
      return `Search results for "${query}" (${results.length} total, showing first 20):\n${lines.join('\n')}`;
    },

    mkdir: () => {
      if (!username) throw new Error('mkdir requires authentication');
      const folderPath = arguments_obj?.folder_path;
      if (!folderPath) throw new Error('mkdir requires a "folder_path" parameter');
      fileService.createFolder(username, folderPath);
      return `Folder created: ${folderPath}`;
    },

    // --- Backward-compatible aliases (old test tool names) ---

    read_file: () => {
      if (!username) throw new Error('read_file requires authentication');
      const filePath = arguments_obj?.file_path;
      if (!filePath) throw new Error('read_file requires a "file_path" parameter');
      const content = fileService.readFile(username, filePath);
      return `Contents of "${filePath}":\n\n${content}`;
    },

    list_directory: () => {
      if (!username) throw new Error('list_directory requires authentication');
      const dirPath = arguments_obj?.dir_path || '';
      const items = fileService.listDirectory(username, dirPath);
      if (items.length === 0) return `Directory "${dirPath || '(root)'}" is empty.`;
      const lines = items.map(item =>
        `${item.type === 'folder' ? '\ud83d\udcc1' : '\ud83d\udcc4'} ${item.name}${item.size !== undefined ? ` (${(item.size / 1024).toFixed(1)}KB)` : ''}`
      );
      return `Directory listing for "${dirPath || '(root)'}":\n${lines.join('\n')}`;
    },

    write_file: () => {
      if (!username) throw new Error('write_file requires authentication');
      const filePath = arguments_obj?.file_path;
      const content = arguments_obj?.content;
      if (!filePath) throw new Error('write_file requires a "file_path" parameter');
      if (typeof content !== 'string') throw new Error('write_file requires a "content" parameter');
      fileService.writeFile(username, filePath, content);
      return `File created: ${filePath}`;
    },

    edit_file: () => {
      if (!username) throw new Error('edit_file requires authentication');
      const filePath = arguments_obj?.file_path;
      if (!filePath) throw new Error('edit_file requires a "file_path" parameter');
      if (arguments_obj?.search_text !== undefined) {
        // search/replace mode
        const searchText = arguments_obj.search_text;
        const replaceText = arguments_obj?.replace_text ?? '';
        const existing = fileService.readFile(username, filePath);
        if (!existing.includes(searchText)) {
          throw new Error(`Search text not found in "${filePath}"`);
        }
        const updated = existing.split(searchText).join(replaceText);
        fileService.writeFile(username, filePath, updated);
        return `File updated: ${filePath}`;
      }
      const content = arguments_obj?.content;
      if (typeof content !== 'string') throw new Error('edit_file requires a "content" parameter');
      fileService.writeFile(username, filePath, content);
      return `File updated: ${filePath}`;
    },

    create_folder: () => {
      if (!username) throw new Error('create_folder requires authentication');
      const folderPath = arguments_obj?.folder_path;
      if (!folderPath) throw new Error('create_folder requires a "folder_path" parameter');
      fileService.createFolder(username, folderPath);
      return `Folder created: ${folderPath}`;
    },

    delete_file: () => {
      if (!username) throw new Error('delete_file requires authentication');
      const filePath = arguments_obj?.file_path;
      if (!filePath) throw new Error('delete_file requires a "file_path" parameter');
      fileService.deleteItem(username, filePath);
      return `Deleted: ${filePath}`;
    },

    rename_file: () => {
      if (!username) throw new Error('rename_file requires authentication');
      const filePath = arguments_obj?.file_path;
      const newName = arguments_obj?.new_name;
      if (!filePath) throw new Error('rename_file requires a "file_path" parameter');
      if (!newName) throw new Error('rename_file requires a "new_name" parameter');
      fileService.renameItem(username, filePath, newName);
      return `Renamed: ${filePath} → ${newName}`;
    },

    file_search: () => {
      if (!username) throw new Error('file_search requires authentication');
      const query = arguments_obj?.query;
      const limit = arguments_obj?.limit || 50;
      if (!query) throw new Error('file_search requires a "query" parameter');
      const results = fileService.searchWorkspace(username, query, { limit });
      if (results.length === 0) return `No files matching "${query}".`;
      const lines = results.slice(0, 20).map(r =>
        `- ${r.path}${r.matchType === 'filename' ? ' (filename match)' : ' (content match)'}\n  ${r.snippet || ''}`
      );
      return `Search results for "${query}" (${results.length} total, showing first 20):\n${lines.join('\n')}`;
    },

    file_read: () => {
      if (!username) throw new Error('file_read requires authentication');
      const filePath = arguments_obj?.file_path;
      if (!filePath) throw new Error('file_read requires a "file_path" parameter');
      const content = fileService.readFile(username, filePath);
      return `Contents of "${filePath}":\n\n${content}`;
    },

    file_create: () => {
      if (!username) throw new Error('file_create requires authentication');
      const filePath = arguments_obj?.file_path;
      const content = arguments_obj?.content;
      if (!filePath) throw new Error('file_create requires a "file_path" parameter');
      if (typeof content !== 'string') throw new Error('file_create requires a "content" parameter');
      fileService.writeFile(username, filePath, content);
      return `File created: ${filePath}`;
    },

    file_update: () => {
      if (!username) throw new Error('file_update requires authentication');
      const filePath = arguments_obj?.file_path;
      const content = arguments_obj?.content;
      if (!filePath) throw new Error('file_update requires a "file_path" parameter');
      if (typeof content !== 'string') throw new Error('file_update requires a "content" parameter');
      fileService.writeFile(username, filePath, content);
      return `File updated: ${filePath}`;
    },

    tag_files_by_tag: () => {
      requireUsername(username, 'tag_files_by_tag');
      const tagName = arguments_obj?.tag_name || arguments_obj?.tagName;
      if (!tagName) throw new Error('tag_files_by_tag requires a "tag_name" parameter');
      const files = tagService.getFilesByTag(username, tagName);
      if (files.length === 0) return `No files with tag: ${tagName}`;
      return `Files tagged "${tagName}":\n${formatFileResults(files)}`;
    },

    location_files_by_location: () => {
      requireUsername(username, 'location_files_by_location');
      const locationName = arguments_obj?.location_name || arguments_obj?.locationName;
      if (!locationName) throw new Error('location_files_by_location requires a "location_name" parameter');
      const files = locationService.getFilesByLocation(username, locationName);
      if (files.length === 0) return `No files with location: ${locationName}`;
      return `Files at "${locationName}":\n${formatFileResults(files)}`;
    },

    // --- Knowledge Graph tools ---

    read_graph: () => {
      if (!username) throw new Error('read_graph requires authentication');
      const g = graphService.loadGraph(username);
      return graphService.formatGraph(g);
    },
    search_nodes: () => {
      if (!username) throw new Error('search_nodes requires authentication');
      const query = arguments_obj?.query || '';
      if (!query) throw new Error('search_nodes requires a "query" parameter');
      const results = graphService.searchEntities(username, query);
      if (results.length === 0) return `No entities found matching "${query}".`;
      return graphService.formatGraph({ entities: Object.fromEntries(results.map(r => [r.name, r])), relations: [] });
    },
    open_nodes: () => {
      if (!username) throw new Error('open_nodes requires authentication');
      const names = arguments_obj?.names || [];
      if (names.length === 0) throw new Error('open_nodes requires a "names" array');
      const entities = {};
      for (const n of names) {
        const e = graphService.getEntity(username, n);
        if (e) entities[n] = { name: n, ...e };
      }
      if (Object.keys(entities).length === 0) return 'No matching entities found.';
      return graphService.formatGraph({ entities, relations: [] });
    },
    create_entities: () => {
      if (!username) throw new Error('create_entities requires authentication');
      const entities = arguments_obj?.entities || [];
      if (entities.length === 0) throw new Error('create_entities requires an "entities" array');
      const results = [];
      for (const ent of entities) {
        const result = graphService.createEntity(username, ent.name, ent.entityType, ent.observations || []);
        results.push(result);
      }
      const successCount = results.filter(r => r.success).length;
      const errors = results.filter(r => !r.success).map(r => r.error);
      return `Created ${successCount}/${entities.length} entities.${errors.length > 0 ? '\nErrors: ' + errors.join('; ') : ''}`;
    },
    create_relations: () => {
      if (!username) throw new Error('create_relations requires authentication');
      const relations = arguments_obj?.relations || [];
      if (relations.length === 0) throw new Error('create_relations requires a "relations" array');
      const result = graphService.createRelations(username, relations);
      const successCount = result.results.filter(r => r.success).length;
      const errors = result.results.filter(r => !r.success).map(r => r.error);
      return `Created ${successCount}/${relations.length} relations.${errors.length > 0 ? '\nErrors: ' + errors.join('; ') : ''}`;
    },
    add_observations: () => {
      if (!username) throw new Error('add_observations requires authentication');
      const observations = arguments_obj?.observations || [];
      if (observations.length === 0) throw new Error('add_observations requires an "observations" array');
      const results = [];
      for (const obs of observations) {
        const result = graphService.addObservations(username, obs.entityName, obs.contents || []);
        results.push(result);
      }
      const successCount = results.filter(r => r.success).length;
      const errors = results.filter(r => !r.success).map(r => r.error);
      return `Added observations to ${successCount}/${observations.length} entities.${errors.length > 0 ? '\nErrors: ' + errors.join('; ') : ''}`;
    },
    delete_entities: () => {
      if (!username) throw new Error('delete_entities requires authentication');
      const entityNames = arguments_obj?.entityNames || [];
      if (entityNames.length === 0) throw new Error('delete_entities requires an "entityNames" array');
      const result = graphService.deleteEntities(username, entityNames);
      return `Deleted ${result.deleted.length} entities: ${result.deleted.join(', ') || '(none existed)'}`;
    },
    delete_observations: () => {
      if (!username) throw new Error('delete_observations requires authentication');
      const deletions = arguments_obj?.deletions || [];
      if (deletions.length === 0) throw new Error('delete_observations requires a "deletions" array');
      const result = graphService.deleteObservations(username, deletions);
      const totalRemoved = result.results.reduce((sum, r) => sum + (r.removed || 0), 0);
      return `Deleted ${totalRemoved} observations across ${result.results.filter(r => r.success).length} entities.`;
    },
    delete_relations: () => {
      if (!username) throw new Error('delete_relations requires authentication');
      const relations = arguments_obj?.relations || [];
      if (relations.length === 0) throw new Error('delete_relations requires a "relations" array');
      const result = graphService.deleteRelations(username, relations);
      return `Deleted ${result.removed} relations.`;
    },

    // --- Tag tools ---

    tag_list: () => {
      const tags = tagService.getAllTags();
      if (tags.length === 0) return 'No tags registered.';
      const lines = tags.map(t => `- ${t.name} (${t.color})${t.description ? ': ' + t.description : ''}`);
      return `Registered tags (${tags.length}):\n${lines.join('\n')}`;
    },
    tag_create: () => {
      const name = arguments_obj?.name;
      if (!name) throw new Error('tag_create requires a "name" parameter');
      const tag = tagService.createTag(name, arguments_obj?.color, arguments_obj?.description);
      return `Created tag: ${tag.name} (${tag.color})${tag.description ? ' - ' + tag.description : ''}`;
    },
    tag_get_file_tags: () => {
      if (!username) throw new Error('tag_get_file_tags requires authentication');
      const filePath = arguments_obj?.file_path || arguments_obj?.filePath;
      if (!filePath) throw new Error('tag_get_file_tags requires a "file_path" parameter');
      const tags = tagService.getFileTags(username, filePath);
      if (tags.length === 0) return `No tags on file: ${filePath}`;
      return `Tags on "${filePath}": ${tags.join(', ')}`;
    },
    tag_add_to_file: () => {
      if (!username) throw new Error('tag_add_to_file requires authentication');
      const filePath = arguments_obj?.file_path || arguments_obj?.filePath;
      const tags = requireStringArray(arguments_obj?.tags || [], 'tags', 'tag_add_to_file');
      if (!filePath) throw new Error('tag_add_to_file requires a "file_path" parameter');
      const result = tagService.addTagsToFile(username, filePath, tags);
      const added = result.added || [];
      return `Added ${added.length} tags to "${filePath}": ${added.join(', ')}`;
    },
    tag_remove_from_file: () => {
      if (!username) throw new Error('tag_remove_from_file requires authentication');
      const filePath = arguments_obj?.file_path || arguments_obj?.filePath;
      const tags = requireStringArray(arguments_obj?.tags || [], 'tags', 'tag_remove_from_file');
      if (!filePath) throw new Error('tag_remove_from_file requires a "file_path" parameter');
      const removed = tags.map(tag => tagService.removeTagFromFile(username, filePath, tag).removed);
      return `Removed ${removed.length} tags from "${filePath}": ${removed.join(', ')}`;
    },
    tag_get_files: () => {
      requireUsername(username, 'tag_get_files');
      const tagName = arguments_obj?.tag_name || arguments_obj?.tagName;
      if (!tagName) throw new Error('tag_get_files requires a "tag_name" parameter');
      const files = tagService.getFilesByTag(username, tagName);
      if (files.length === 0) return `No files with tag: ${tagName}`;
      return `Files tagged "${tagName}":\n${formatFileResults(files)}`;
    },

    // --- Location tools ---

    location_list: () => {
      requireUsername(username, 'location_list');
      const locations = locationService.getAllLocations(username);
      if (locations.length === 0) return 'No locations registered.';
      const lines = locations.map(l => `- ${l.name} (${l.color})${l.description ? ': ' + l.description : ''}`);
      return `Registered locations (${locations.length}):\n${lines.join('\n')}`;
    },
    location_create: () => {
      requireUsername(username, 'location_create');
      const name = arguments_obj?.name;
      if (!name) throw new Error('location_create requires a "name" parameter');
      const loc = locationService.createLocation(username, name, arguments_obj?.color, arguments_obj?.description);
      return `Created location: ${loc.name} (${loc.color})${loc.description ? ' - ' + loc.description : ''}`;
    },
    location_get_file_locations: () => {
      if (!username) throw new Error('location_get_file_locations requires authentication');
      const filePath = arguments_obj?.file_path || arguments_obj?.filePath;
      if (!filePath) throw new Error('location_get_file_locations requires a "file_path" parameter');
      const locations = locationService.getFileLocations(username, filePath);
      if (locations.length === 0) return `No locations on file: ${filePath}`;
      return `Locations on "${filePath}": ${locations.join(', ')}`;
    },
    location_add_to_file: () => {
      if (!username) throw new Error('location_add_to_file requires authentication');
      const filePath = arguments_obj?.file_path || arguments_obj?.filePath;
      const locations = requireStringArray(arguments_obj?.locations || [], 'locations', 'location_add_to_file');
      if (!filePath) throw new Error('location_add_to_file requires a "file_path" parameter');
      const result = locationService.addLocationsToFile(username, filePath, locations);
      const added = result.added || [];
      return `Added ${added.length} locations to "${filePath}": ${added.join(', ')}`;
    },
    location_remove_from_file: () => {
      if (!username) throw new Error('location_remove_from_file requires authentication');
      const filePath = arguments_obj?.file_path || arguments_obj?.filePath;
      const locations = requireStringArray(arguments_obj?.locations || [], 'locations', 'location_remove_from_file');
      if (!filePath) throw new Error('location_remove_from_file requires a "file_path" parameter');
      const removed = locations.map(location => locationService.removeLocationFromFile(username, filePath, location).removed);
      return `Removed ${removed.length} locations from "${filePath}": ${removed.join(', ')}`;
    },
    location_get_files: () => {
      requireUsername(username, 'location_get_files');
      const locationName = arguments_obj?.location_name || arguments_obj?.locationName;
      if (!locationName) throw new Error('location_get_files requires a "location_name" parameter');
      const files = locationService.getFilesByLocation(username, locationName);
      if (files.length === 0) return `No files with location: ${locationName}`;
      return `Files at "${locationName}":\n${formatFileResults(files)}`;
    },

    // --- Image Generation tool ---

    image_generate: () => {
      if (!username) throw new Error('image_generate requires authentication');
      const prompt = arguments_obj?.prompt;
      if (!prompt) throw new Error('image_generate requires a "prompt" parameter');
      // Delegate to llmService.imageGenerationService
      // This tool is defined in getToolDefinitions but executed via the /api/llm/generate-image endpoint
      return 'Image generation is handled through the /api/llm/generate-image endpoint. Please use the image generation UI.';
    },

    // --- Reminder tools ---

    reminder_list: () => {
      if (!username) throw new Error('reminder_list requires authentication');
      const reminders = reminderService.getByUser(username);
      if (reminders.length === 0) return 'No reminders set.';
      const lines = reminders.map(r =>
        `- [${r.status}] ${r.title} (due: ${new Date(r.fireAt).toLocaleString()})${r.filePath ? ' — ' + r.filePath : ''}`
      );
      return `Reminders (${reminders.length}):\n${lines.join('\n')}`;
    },
    reminder_create: () => {
      if (!username) throw new Error('reminder_create requires authentication');
      const title = arguments_obj?.title;
      const fireAt = arguments_obj?.fireAt;
      const filePath = arguments_obj?.file_path;
      if (!title) throw new Error('reminder_create requires a "title" parameter');
      if (!fireAt) throw new Error('reminder_create requires a "fireAt" parameter (ISO date)');
      const reminder = reminderService.create(username, { title, fireAt, filePath });
      return `Reminder created: "${title}" due ${new Date(fireAt).toLocaleString()}`;
    },
    reminder_delete: () => {
      if (!username) throw new Error('reminder_delete requires authentication');
      const id = arguments_obj?.id;
      if (!id) throw new Error('reminder_delete requires an "id" parameter');
      const result = reminderService.remove(id, username);
      if (!result.success) throw new Error('reminder_delete failed: reminder not found or permission denied');
      return `Reminder deleted: ${id}`;
    },
  };

  const handler = tools[toolName];
  if (!handler) {
    const available = Object.keys(tools).join(', ');
    throw new Error(`Unknown tool: "${toolName}". Available tools: ${available}`);
  }

  return handler();
}

/**
 * Get tool definitions for the LLM's function calling.
 * @param {Object} [permissions] - User tool permissions
 */
function getToolDefinitions(permissions) {
  const tools = [];

  // Web Search tool (gated by webSearch permission)
  if (permissions?.webSearch) {
    tools.push({
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web for current information.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            max_results: { type: 'integer', description: 'Max results (default 5)' },
          },
          required: ['query'],
        },
      },
    });
  }

  // Knowledge Graph tools (gated by allowGraph permission)
  if (permissions?.allowGraph) {
    tools.push({
      type: 'function',
      function: {
        name: 'read_graph',
        description: 'Read the entire knowledge graph for the current user.',
        parameters: { type: 'object', properties: {} },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'search_nodes',
        description: 'Search for entities in the knowledge graph by name or content.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Search query' } },
          required: ['query'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'open_nodes',
        description: 'Open specific entities by name from the knowledge graph.',
        parameters: {
          type: 'object',
          properties: { names: { type: 'array', items: { type: 'string' }, description: 'Entity names to open' } },
          required: ['names'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'create_entities',
        description: 'Create multiple entities in the knowledge graph.',
        parameters: {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Entity name' },
                  entityType: { type: 'string', description: 'Entity type' },
                  observations: { type: 'array', items: { type: 'string' }, description: 'Observations about the entity' },
                },
                required: ['name', 'entityType'],
              },
            },
          },
          required: ['entities'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'create_relations',
        description: 'Create multiple relations between entities. Relations should be in active voice (e.g., "knows" not "is known by").',
        parameters: {
          type: 'object',
          properties: {
            relations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string', description: 'Entity where relation starts' },
                  to: { type: 'string', description: 'Entity where relation ends' },
                  relationType: { type: 'string', description: 'Type of relation' },
                },
                required: ['from', 'to', 'relationType'],
              },
            },
          },
          required: ['relations'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'add_observations',
        description: 'Add new observations to existing entities in the knowledge graph.',
        parameters: {
          type: 'object',
          properties: {
            observations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  entityName: { type: 'string', description: 'Entity to add observations to' },
                  contents: { type: 'array', items: { type: 'string' }, description: 'Observations to add' },
                },
                required: ['entityName', 'contents'],
              },
            },
          },
          required: ['observations'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'delete_entities',
        description: 'Delete entities and their associated relations from the knowledge graph.',
        parameters: {
          type: 'object',
          properties: {
            entityNames: { type: 'array', items: { type: 'string' }, description: 'Entities to delete' },
          },
          required: ['entityNames'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'delete_observations',
        description: 'Delete specific observations from entities.',
        parameters: {
          type: 'object',
          properties: {
            deletions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  entityName: { type: 'string' },
                  observations: { type: 'array', items: { type: 'string' } },
                },
                required: ['entityName', 'observations'],
              },
            },
          },
          required: ['deletions'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'delete_relations',
        description: 'Delete specific relations from the knowledge graph.',
        parameters: {
          type: 'object',
          properties: {
            relations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                  relationType: { type: 'string' },
                },
                required: ['from', 'to', 'relationType'],
              },
            },
          },
          required: ['relations'],
        },
      },
    });
  }

  // Tag tools (gated by allowTags permission)
  if (permissions?.allowTags) {
    tools.push({
      type: 'function',
      function: {
        name: 'tag_list',
        description: 'List all registered tags.',
        parameters: { type: 'object', properties: {} },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'tag_create',
        description: 'Create a new tag.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tag name' },
            color: { type: 'string', description: 'Tag color hex' },
            description: { type: 'string', description: 'Tag description' },
          },
          required: ['name'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'tag_get_file_tags',
        description: 'Get all tags on a file.',
        parameters: {
          type: 'object',
          properties: { file_path: { type: 'string', description: 'File path' } },
          required: ['file_path'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'tag_add_to_file',
        description: 'Add tags to a file.',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'File path' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag names to add' },
          },
          required: ['file_path', 'tags'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'tag_remove_from_file',
        description: 'Remove tags from a file.',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'File path' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag names to remove' },
          },
          required: ['file_path', 'tags'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'tag_get_files',
        description: 'Get all files with a specific tag.',
        parameters: {
          type: 'object',
          properties: { tag_name: { type: 'string', description: 'Tag name' } },
          required: ['tag_name'],
        },
      },
    });
  }

  // Location tools (gated by allowLocations permission)
  if (permissions?.allowLocations) {
    tools.push({
      type: 'function',
      function: {
        name: 'location_list',
        description: 'List all registered locations.',
        parameters: { type: 'object', properties: {} },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'location_create',
        description: 'Create a new location.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Location name' },
            color: { type: 'string', description: 'Location color hex' },
            description: { type: 'string', description: 'Location description' },
          },
          required: ['name'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'location_get_file_locations',
        description: 'Get all locations on a file.',
        parameters: {
          type: 'object',
          properties: { file_path: { type: 'string', description: 'File path' } },
          required: ['file_path'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'location_add_to_file',
        description: 'Add locations to a file.',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'File path' },
            locations: { type: 'array', items: { type: 'string' }, description: 'Location names to add' },
          },
          required: ['file_path', 'locations'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'location_remove_from_file',
        description: 'Remove locations from a file.',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'File path' },
            locations: { type: 'array', items: { type: 'string' }, description: 'Location names to remove' },
          },
          required: ['file_path', 'locations'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'location_get_files',
        description: 'Get all files at a specific location.',
        parameters: {
          type: 'object',
          properties: { location_name: { type: 'string', description: 'Location name' } },
          required: ['location_name'],
        },
      },
    });
  }

  // --- Backward-compatible Tag/Location alias definitions ---
  if (permissions?.allowTags) {
    tools.push({
      type: 'function',
      function: {
        name: 'tag_files_by_tag',
        description: 'Get all files with a specific tag.',
        parameters: {
          type: 'object',
          properties: { tag_name: { type: 'string', description: 'Tag name' } },
          required: ['tag_name'],
        },
      },
    });
  }

  if (permissions?.allowLocations) {
    tools.push({
      type: 'function',
      function: {
        name: 'location_files_by_location',
        description: 'Get all files at a specific location.',
        parameters: {
          type: 'object',
          properties: { location_name: { type: 'string', description: 'Location name' } },
          required: ['location_name'],
        },
      },
    });
  }

  // --- User-scoped File Tools (gated by allowFiles master + granular perms) ---
  // Support both new-style (allowRead/allowWrite/etc.) and old-style (fileAccessLevel) permissions
  const hasGranularPerms = permissions?.allowRead || permissions?.allowWrite || permissions?.allowDelete || permissions?.allowRename || permissions?.allowSearch;
  const FileAccessLevel = permissions?.fileAccessLevel;
  let effRead = permissions?.allowRead || FileAccessLevel === 'read' || FileAccessLevel === 'readwrite' || FileAccessLevel === 'full';
  let effWrite = permissions?.allowWrite || FileAccessLevel === 'readwrite' || FileAccessLevel === 'full';
  let effDelete = permissions?.allowDelete || FileAccessLevel === 'full';
  let effRename = permissions?.allowRename || FileAccessLevel === 'full';
  let effSearch = permissions?.allowSearch || FileAccessLevel === 'read' || FileAccessLevel === 'readwrite' || FileAccessLevel === 'full';
  let effCreate = permissions?.allowCreate || FileAccessLevel === 'readwrite' || FileAccessLevel === 'full';
  if (permissions?.allowFiles && !hasGranularPerms && !FileAccessLevel) {
    effRead = true; effWrite = true; effDelete = true; effRename = true; effSearch = true; effCreate = true;
  }

  if (permissions?.allowFiles) {
    if (effRead) {
      tools.push({
        type: 'function',
        function: {
          name: 'read',
          description: 'Read the contents of a file from the user workspace.',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path to the file relative to workspace root' },
            },
            required: ['file_path'],
          },
        },
      });
      tools.push({
        type: 'function',
        function: {
          name: 'list',
          description: 'List files and folders in a directory within the user workspace.',
          parameters: {
            type: 'object',
            properties: {
              dir_path: { type: 'string', description: 'Directory path (empty for root)' },
            },
          },
        },
      });
    }

    if (effWrite) {
      tools.push({
        type: 'function',
        function: {
          name: 'write',
          description: 'Create a new file in the user workspace. Use this for new files only.',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path for the new file relative to workspace root' },
              content: { type: 'string', description: 'Content to write to the file' },
            },
            required: ['file_path', 'content'],
          },
        },
      });
      tools.push({
        type: 'function',
        function: {
          name: 'edit',
          description: 'Overwrite the entire contents of an existing file. Read the file first before editing.',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path to the file relative to workspace root' },
              content: { type: 'string', description: 'New content to write (full file content)' },
            },
            required: ['file_path', 'content'],
          },
        },
      });
      tools.push({
        type: 'function',
        function: {
          name: 'copy',
          description: 'Copy a file within the user workspace. If no dest_folder, copies in same folder with -copy suffix.',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path to the file to copy' },
              dest_folder: { type: 'string', description: 'Optional destination folder path' },
            },
            required: ['file_path'],
          },
        },
      });
      tools.push({
        type: 'function',
        function: {
          name: 'move',
          description: 'Move a file to a different folder within the user workspace.',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path to the file to move' },
              dest_folder: { type: 'string', description: 'Destination folder path' },
            },
            required: ['file_path', 'dest_folder'],
          },
        },
      });
      tools.push({
        type: 'function',
        function: {
          name: 'mkdir',
          description: 'Create a new folder in the user workspace.',
          parameters: {
            type: 'object',
            properties: {
              folder_path: { type: 'string', description: 'Path for the new folder' },
            },
            required: ['folder_path'],
          },
        },
      });
    }

    if (effDelete) {
      tools.push({
        type: 'function',
        function: {
          name: 'delete',
          description: 'Delete a file or folder from the user workspace.',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path to the file or folder to delete' },
            },
            required: ['file_path'],
          },
        },
      });
    }

    if (effRename) {
      tools.push({
        type: 'function',
        function: {
          name: 'rename',
          description: 'Rename a file within the same directory. Only change the filename, not the path.',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Current path to the file' },
              new_name: { type: 'string', description: 'New filename (not a path, just the name)' },
            },
            required: ['file_path', 'new_name'],
          },
        },
      });
    }

    if (effSearch) {
      tools.push({
        type: 'function',
        function: {
          name: 'search',
          description: 'Search user workspace recursively for files matching a query (in filenames and contents).',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'integer', description: 'Max results (default 50)' },
            },
            required: ['query'],
          },
        },
      });
    }

    // --- Backward-compatible file tool definitions (old-style names) ---
    if (FileAccessLevel || !hasGranularPerms) {
      if (effRead) {
        tools.push({ type: 'function', function: { name: 'file_read', description: 'Read the contents of a file.', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } } });
        tools.push({ type: 'function', function: { name: 'read_file', description: 'Read the contents of a file.', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } } });
        tools.push({ type: 'function', function: { name: 'list_directory', description: 'List files in a directory.', parameters: { type: 'object', properties: { dir_path: { type: 'string' } } } } });
      }
      if (effSearch) {
        tools.push({ type: 'function', function: { name: 'file_search', description: 'Search user workspace.', parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer' } }, required: ['query'] } } });
      }
      if (effWrite) {
        tools.push({ type: 'function', function: { name: 'file_create', description: 'Create a new file.', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } } });
        tools.push({ type: 'function', function: { name: 'file_update', description: 'Update an existing file.', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } } });
        tools.push({ type: 'function', function: { name: 'write_file', description: 'Write content to a file.', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } } });
        tools.push({ type: 'function', function: { name: 'edit_file', description: 'Edit a file.', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' }, search_text: { type: 'string' }, replace_text: { type: 'string' } }, required: ['file_path'] } } });
      }
      if (effCreate) {
        tools.push({ type: 'function', function: { name: 'create_folder', description: 'Create a new folder.', parameters: { type: 'object', properties: { folder_path: { type: 'string' } }, required: ['folder_path'] } } });
      }
      if (effDelete) {
        tools.push({ type: 'function', function: { name: 'delete_file', description: 'Delete a file.', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } } });
      }
      if (effRename) {
        tools.push({ type: 'function', function: { name: 'rename_file', description: 'Rename a file.', parameters: { type: 'object', properties: { file_path: { type: 'string' }, new_name: { type: 'string' } }, required: ['file_path', 'new_name'] } } });
      }
    }
  }

  // Image Generation tool (gated by allowImageGen permission)
  if (permissions?.allowImageGen) {
    tools.push({
      type: 'function',
      function: {
        name: 'image_generate',
        description: 'Generate an image via Z-Image. Z-Image must already be running at http://127.0.0.1:18051.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Image generation prompt' },
            negative_prompt: { type: 'string', description: 'Negative prompt' },
            width: { type: 'integer', description: 'Image width (default 512)' },
            height: { type: 'integer', description: 'Image height (default 512)' },
            num_steps: { type: 'integer', description: 'Number of inference steps (default 20)' },
            guidance: { type: 'number', description: 'CFG guidance scale (default 7.5)' },
            seed: { type: 'integer', description: 'Random seed (-1 for random)' },
          },
          required: ['prompt'],
        },
      },
    });
  }

  // Reminder tools (gated by allowReminders permission)
  if (permissions?.allowReminders) {
    tools.push({
      type: 'function',
      function: {
        name: 'reminder_list',
        description: 'List all reminders for the user.',
        parameters: { type: 'object', properties: {} },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'reminder_create',
        description: 'Create a new reminder with a title and due date.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Reminder title' },
            fireAt: { type: 'string', description: 'ISO date/time when reminder should fire' },
            file_path: { type: 'string', description: 'Optional file path to associate' },
          },
          required: ['title', 'fireAt'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'reminder_delete',
        description: 'Delete a reminder by ID.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Reminder ID' } },
          required: ['id'],
        },
      },
    });
  }

  return tools;
}

export {
  executeTool,
  getToolDefinitions,
  webSearch,
  fetchWebpage,
};
