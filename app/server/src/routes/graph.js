import express from 'express';
import config from '../config.js';
import path from 'path';
import fs from 'fs';
import { getUserWorkspaceDir } from '../services/authService.js';
import * as tagService from '../services/tagService.js';
import * as llmService from '../services/llmService.js';
import * as locationService from '../services/locationService.js';

const TIMELINE_METADATA_FILE = '.wbu_timeline_metadata.json';

/**
 * Load persisted timeline metadata from sidecar JSON
 */
function loadTimelineMetadata(workspaceRoot) {
  const metaPath = path.join(workspaceRoot, TIMELINE_METADATA_FILE);
  if (fs.existsSync(metaPath)) {
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

const router = express.Router();

// Binary/asset extensions to skip
const BINARY_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico',
  'pdf', 'zip', 'tar', 'gz', 'rar', '7z',
  'mp3', 'mp4', 'avi', 'mov', 'wmv',
  'exe', 'dll', 'so', 'dylib',
  'docx', 'xlsx', 'pptx',
]);

function isScannableFile(filename) {
  if (filename.startsWith('.')) return false;
  const ext = path.extname(filename).toLowerCase().slice(1);
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return true;
}

/**
 * Extract heading preview from HTML content for LLM context
 */
function extractHeadingPreview(html) {
  if (!html) return '';
  const headings = [];
  const hRegex = /<h([1-6])[^>]*>([^<]+)<\/h\1>/gi;
  let m;
  while ((m = hRegex.exec(html)) !== null) {
    headings.push(`H${m[1]}: ${m[2]}`);
  }
  let preview = headings.join(' | ');
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (textContent.length > 200) {
    preview += ' | Summary: ' + textContent.slice(0, 200) + '...';
  } else if (textContent.length > 0) {
    preview += ' | Summary: ' + textContent;
  }
  return preview;
}

/**
 * Get tag color map from registry
 */
function buildTagColorMap() {
  const tagRegistry = tagService.getAllTags();
  const tagColorMap = {};
  for (const tag of tagRegistry) {
    tagColorMap[tag.name] = tag.color;
  }
  return tagColorMap;
}

/**
 * Determine node color from tags or folder
 */
function getNodeColor(fileTags, tagColorMap, relativePath) {
  const folder = path.dirname(relativePath);
  const folderName = folder ? path.basename(folder) : '';

  if (fileTags.length > 0) {
    return tagColorMap[fileTags[0]] || '#a78bfa';
  }
  // Folder-based defaults
  if (relativePath.startsWith('PlayerCharacters') || folderName === 'PlayerCharacters') return '#f59e0b';
  if (relativePath.startsWith('NPCs') || folderName === 'NPCs') return '#6b7280';
  if (relativePath.startsWith('World/Timeline') || folderName === 'Timeline') return '#a78bfa';
  if (relativePath.startsWith('World/Items') || folderName === 'Items') return '#06b6d4';
  if (relativePath.startsWith('World/Creatures') || folderName === 'Creatures') return '#ef4444';
  if (relativePath.startsWith('World/Factions') || folderName === 'Factions') return '#ec4899';
  if (relativePath.startsWith('World') && !relativePath.startsWith('World/Timeline') && !relativePath.startsWith('World/Items') && !relativePath.startsWith('World/Creatures') && !relativePath.startsWith('World/Factions')) return '#22c55e';
  if (relativePath.startsWith('Quests') || folderName === 'Quests') return '#3b82f6';
  return '#6b7280';
}

/**
 * Scan workspace and collect candidate files related to a seed
 * Candidates are files that share tags, folder, era, or location with the seed
 */
function collectCandidateFiles(username, seedMeta, options = {}) {
  const workspaceRoot = getUserWorkspaceDir(username);
  const candidates = [];

  if (!fs.existsSync(workspaceRoot)) {
    return candidates;
  }

  const tagColorMap = buildTagColorMap();
  const timelineMeta = loadTimelineMetadata(workspaceRoot);
  const { relationshipTypes = [], depth = 1 } = options;

  // Seed properties for matching
  const seedTags = seedMeta.tags || [];
  const seedFolder = path.dirname(seedMeta.path);
  const seedEra = seedMeta.era || '';
  const seedLocations = seedMeta.locations || [];

  // For 2-hop: collect first-hop tags to expand candidate pool
  let expandedTags = new Set(seedTags);

  function walkDir(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walkDir(path.join(dirPath, entry.name));
        } else if (entry.isFile() && isScannableFile(entry.name)) {
          const relativePath = path.relative(workspaceRoot, path.join(dirPath, entry.name));

          // Skip the seed itself
          if (relativePath === seedMeta.path) continue;

          // Load metadata
          const meta = tagService.loadFileMeta(username, relativePath);
          const fileTags = meta.tags || [];

          // Load timeline metadata
          const tlStored = timelineMeta[relativePath] || {};
          const era = tlStored.era || '';
          const date = tlStored.date || '';

          // Determine if this file is a candidate (shares something with seed)
          let reasons = [];

          // Tag overlap
          const sharedTags = fileTags.filter(t => expandedTags.has(t));
          if (sharedTags.length > 0) {
            reasons.push('shared_tags');
          }

          // Same folder
          const fileFolder = path.dirname(relativePath);
          if (fileFolder === seedFolder) {
            reasons.push('same_folder');
          }

          // Same era
          if (seedEra && era === seedEra) {
            reasons.push('same_era');
          }

          // Same location
          const fileLocations = meta.locations || [];
          const sharedLocations = [];
          if (fileLocations.length > 0 && seedLocations.length > 0) {
            for (const l of fileLocations) {
              if (seedLocations.includes(l)) {
                sharedLocations.push(l);
              }
            }
          }
          if (sharedLocations.length > 0) {
            reasons.push('same_location');
          }

          // Must share at least one property to be a candidate
          if (reasons.length === 0) continue;

          // Read file content for heading preview (for LLM context)
          let headingPreview = '';
          try {
            const content = fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf-8');
            headingPreview = extractHeadingPreview(content);
          } catch {
            // Skip content extraction on error
          }

          // Build tag metadata with colors
          const tagsMeta = fileTags.map(t => ({
            name: t,
            color: tagColorMap[t] || '#a78bfa',
          }));

          const color = getNodeColor(fileTags, tagColorMap, relativePath);
          const label = entry.name.replace(/\.html$/, '').replace(/_/g, ' ');

          candidates.push({
            path: relativePath,
            name: label,
            tags: fileTags,
            tagsMeta,
            color,
            folder: fileFolder || '/',
            headingPreview,
            era,
            date,
            reasons,
            sharedTags,
            sharedLocations,
          });

          // For 2-hop: expand tag pool with candidate tags
          if (depth > 1) {
            for (const t of fileTags) {
              expandedTags.add(t);
            }
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walkDir(workspaceRoot);
  return candidates;
}

/**
 * System prompt for the LLM to generate seed-centric graph data
 */
const SEED_GRAPH_SYSTEM_PROMPT = `You are a relationship graph analyzer for WORBI, a world-building document editor.

The user has selected a specific document (the "seed") and provided a list of candidate documents that share tags, folders, eras, or locations with it.

Your task is to analyze the semantic relationships between the seed document and each candidate, and generate edges only for genuine connections.

Analyze for these relationship types:
- "character_connection": Characters who interact, share history, or have conflicts
- "location_connection": Locations linked to characters, events, or each other
- "time_connection": Chronological relationships, events in the same period, before/after ordering
- "thematic": Documents sharing themes, motifs, or symbolic connections
- "narrative": Cause/effect relationships, plot relevance, story arcs
- "tag_based": Documents sharing the same tags (implicit connection)
- "era_based": Documents belonging to the same timeline era (implicit connection)
- "location_based": Documents sharing the same location metadata (implicit connection)

Return ONLY valid JSON in this exact format (no markdown, no explanations):
{
  "edges": [
    {
      "target": "exact_candidate_file_path.html",
      "type": "character_connection",
      "label": "Brief description of relationship",
      "strength": 3
    }
  ]
}

Rules:
- Every edge "target" must EXACTLY match the "path" of a candidate from the input
- Every edge "source" is implicitly the seed (do NOT include a source field)
- Edge "strength" is 1-5 (5 = very strong connection)
- Edge "label" should be a short, descriptive phrase (max 60 chars)
- Only include edges where you detect a genuine semantic relationship
- Be conservative with edges - quality over quantity
- If the relationshipTypes filter is provided, only create edges of those types
- It is valid to return an empty edges array if no genuine connections are found`;

/**
 * Human-readable instructions per relationship type for the LLM prompt
 */
const REL_TYPE_INSTRUCTIONS = {
  character_connection: 'Focus on character relationships: which candidates feature characters that interact with, oppose, ally with, or share history with characters in the seed document?',
  location_connection: 'Focus on location relationships: which candidates describe places linked to the seed, travel routes between locations, or events that take place at the same setting?',
  time_connection: 'Focus on temporal relationships: which candidates describe events that happen before, after, or during the same period as the seed? Look for chronological ordering and cause/effect across time.',
  thematic: 'Focus on thematic connections: which candidates share themes, motifs, symbolism, or philosophical ideas with the seed document?',
  narrative: 'Focus on narrative connections: which candidates are cause/effect of the seed, advance the same plot arc, or are directly relevant to the same storyline?',
  tag_based: 'Focus on tag-based connections: which candidates share the same tags as the seed? This is an implicit connection based on shared metadata.',
  era_based: 'Focus on era-based connections: which candidates belong to the same timeline era as the seed? This is an implicit connection based on shared timeline metadata.',
  location_based: 'Focus on location-based connections: which candidates share the same location metadata as the seed? This is an implicit connection based on shared location metadata.',
};

/**
 * GET /api/llm/graph/eras
 * Return unique eras from timeline metadata for filtering
 */
router.get('/eras', (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const workspaceRoot = getUserWorkspaceDir(username);
    const timelineMeta = loadTimelineMetadata(workspaceRoot);
    const eras = [...new Set(
      Object.values(timelineMeta)
        .map(v => v.era || '')
        .filter(e => e && e.trim())
    )].sort();
    res.json({ eras });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/llm/graph/from-seed
 * Generate a relationship graph radiating from a seed document
 */
router.post('/from-seed', async (req, res) => {
  const username = req.user?.username;
  if (!username) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { seedPath, relationshipTypes = [], useAI = false, depth = 1 } = req.body;

    if (!seedPath) {
      return res.status(400).json({ error: 'seedPath is required' });
    }

    const workspaceRoot = getUserWorkspaceDir(username);
    if (!fs.existsSync(workspaceRoot)) {
      return res.json({ nodes: [], edges: [], model: '', message: 'Workspace not found.' });
    }

    const tagColorMap = buildTagColorMap();
    const timelineMeta = loadTimelineMetadata(workspaceRoot);

    // Validate seed exists
    const seedFullPath = path.join(workspaceRoot, seedPath);
    if (!fs.existsSync(seedFullPath) || !isScannableFile(seedPath)) {
      return res.status(400).json({ error: 'Seed file not found or not scannable.' });
    }

    // Load seed metadata
    const seedMeta = tagService.loadFileMeta(username, seedPath);
    const seedTags = seedMeta.tags || [];

    // Load seed timeline metadata
    const seedTl = timelineMeta[seedPath] || {};
    const seedEra = seedTl.era || '';
    const seedDate = seedTl.date || '';

    // Load seed location metadata
    const seedLocations = locationService.getFileLocations(username, seedPath) || [];

    // Read seed content for preview
    let seedHeadingPreview = '';
    try {
      const content = fs.readFileSync(seedFullPath, 'utf-8');
      seedHeadingPreview = extractHeadingPreview(content);
    } catch {
      // Skip
    }

    const seedLabel = path.basename(seedPath).replace(/\.html$/, '').replace(/_/g, ' ');
    const seedColor = getNodeColor(seedTags, tagColorMap, seedPath);
    const seedFolder = path.dirname(seedPath);

    // Build seed node
    const seedNode = {
      id: seedPath,
      label: seedLabel,
      color: seedColor,
      size: 18,
      tags: seedTags,
      tagsMeta: seedTags.map(t => ({ name: t, color: tagColorMap[t] || '#a78bfa' })),
      era: seedEra,
      date: seedDate,
      isSeed: true,
    };

    // Collect candidate files related to the seed
    const candidates = collectCandidateFiles(username, {
      path: seedPath,
      tags: seedTags,
      era: seedEra,
      locations: seedLocations,
    }, { relationshipTypes, depth });

    if (candidates.length === 0) {
      return res.json({
        nodes: [seedNode],
        edges: [],
        model: useAI ? (config.loadUserSettings(username)?.modelName || '') : 'seed-based (no AI)',
        fileCount: 1,
        message: 'No related files found for this seed.',
      });
    }

    // Build candidate nodes
    const candidateNodes = candidates.map(c => ({
      id: c.path,
      label: c.name,
      color: c.color,
      size: 5 + Math.min(c.tags.length * 2, 15),
      tags: c.tags,
      tagsMeta: c.tagsMeta,
      era: c.era,
      date: c.date,
      isSeed: false,
    }));

    // Generate edges
    let edges = [];

    if (useAI) {
      // LLM-powered semantic analysis
      const settings = config.loadUserSettings(username);

      const seedContext = `- Seed: ${seedPath}
  Name: ${seedLabel}
  Tags: ${seedTags.join(', ') || '(none)'}
  Folder: ${seedFolder}
  Era: ${seedEra || '(none)'}
  Locations: ${seedLocations.join(', ') || '(none)'}
  ${seedHeadingPreview ? 'Content: ' + seedHeadingPreview : ''}`;

      const candidatesContext = candidates.map(c => {
        return `- Path: ${c.path}
  Name: ${c.name}
  Tags: ${c.tags.join(', ') || '(none)'}
  Shared Tags: ${c.sharedTags.join(', ') || '(none)'}
  Shared Locations: ${(c.sharedLocations || []).join(', ') || '(none)'}
  Folder: ${c.folder}
  Era: ${c.era || '(none)'}
  Connection Reasons: ${c.reasons.join(', ')}
  ${c.headingPreview ? 'Content: ' + c.headingPreview : ''}`;
      }).join('\n\n');

      // Build a descriptive relationship filter instruction
      let relContext = '';
      if (relationshipTypes.length > 0) {
        const instructions = relationshipTypes
          .map(rt => REL_TYPE_INSTRUCTIONS[rt] || `Focus on ${rt} relationships.`)
          .join(' ');
        relContext = `Relationship filter: ${instructions}`;
      } else {
        relContext = 'Include all relationship types you detect.';
      }

      const userMessage = `${seedContext}

---

Total candidates: ${candidates.length}

Candidates (files that share tags, folder, era, or location with the seed):
${candidatesContext}

${relContext}

Please analyze the semantic relationships between the seed and each candidate, and return the JSON edges array.`;

      const response = await llmService.sendChatMessage(
        [{ role: 'user', content: userMessage }],
        '',
        SEED_GRAPH_SYSTEM_PROMPT,
        { webSearch: false, fileAccessLevel: 'none', allowCreate: false, allowEdit: false, allowDelete: false, allowRename: false, maxSearchResults: 0 },
        { ...settings, maxTokens: settings.maxTokens || 4096, temperature: 0.3 }
      );

      // Parse LLM response
      let content = response.content || '';
      let graphData = null;

      // Strategy 1: Direct parse
      try { graphData = JSON.parse(content.trim()); } catch {}

      // Strategy 2: Markdown code block
      if (!graphData) {
        const codeMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (codeMatch) {
          try { graphData = JSON.parse(codeMatch[1].trim()); } catch {}
        }
      }

      // Strategy 3: Find { ... } pattern
      if (!graphData) {
        const objMatch = content.match(/\{[\s\S]*"edges"[\s\S]*\}/);
        if (objMatch) {
          try { graphData = JSON.parse(objMatch[0]); } catch {}
        }
      }

      // Strategy 4: Fix trailing commas
      if (!graphData) {
        const fixed = content.replace(/,\s*([\]}])/g, '$1');
        const fixedMatch = fixed.match(/\{[\s\S]*"edges"[\s\S]*\}/);
        if (fixedMatch) {
          try { graphData = JSON.parse(fixedMatch[0]); } catch {}
        }
      }

      // Strategy 5: Extract edges array directly
      if (!graphData) {
        const edgesMatch = content.match(/"edges"\s*:\s*(\[[\s\S]*?\])/);
        if (edgesMatch) {
          try {
            let edgesStr = edgesMatch[1];
            let d = 0, end = -1;
            for (let i = 0; i < edgesStr.length; i++) {
              if (edgesStr[i] === '[') d++;
              else if (edgesStr[i] === ']') { d--; if (d === 0) { end = i + 1; break; } }
            }
            if (end > 0) edgesStr = edgesStr.substring(0, end);
            const parsed = JSON.parse(edgesStr.replace(/,\s*([\]}])/g, '$1'));
            if (Array.isArray(parsed)) {
              graphData = { edges: parsed };
            }
          } catch {}
        }
      }

      if (!graphData || !Array.isArray(graphData.edges)) {
        throw new Error('LLM returned invalid JSON graph data. Check server logs for the raw response.');
      }

      // Build edges from LLM response (add seed as source)
      const candidatePathSet = new Set(candidates.map(c => c.path));
      for (const edge of graphData.edges) {
        const target = edge.target;
        if (candidatePathSet.has(target)) {
          edges.push({
            source: seedPath,
            target,
            type: edge.type || 'thematic',
            label: edge.label || 'Related',
            strength: Math.min(Math.max(Number(edge.strength) || 1, 1), 5),
          });
        }
      }

      // Also add metadata-based edges for candidates the LLM missed
      const edgeTargets = new Set(edges.map(e => e.target));
      for (const c of candidates) {
        if (edgeTargets.has(c.path)) continue;
        if (c.sharedTags.length > 0) {
          edges.push({ source: seedPath, target: c.path, type: 'tag_based', label: c.sharedTags.join(', '), strength: Math.min(c.sharedTags.length, 5) });
        }
        if (seedEra && c.era === seedEra && !edges.find(e => e.target === c.path)) {
          edges.push({ source: seedPath, target: c.path, type: 'era_based', label: 'Shared era: ' + seedEra, strength: 2 });
        }
        if ((c.sharedLocations || []).length > 0 && !edges.find(e => e.target === c.path)) {
          edges.push({ source: seedPath, target: c.path, type: 'location_based', label: 'Shared location: ' + (c.sharedLocations || []).join(', '), strength: 2 });
        }
      }

      const connectedPaths = new Set(edges.map(e => e.target));
      const visibleNodes = candidateNodes.filter(n => connectedPaths.has(n.id));

      res.json({ nodes: [seedNode, ...visibleNodes], edges, model: settings?.modelName || 'seed-based (AI)', fileCount: visibleNodes.length + 1 });
    } else {
      // Non-AI: instant metadata-based edges only
      for (const c of candidates) {
        if (c.sharedTags.length > 0) {
          edges.push({ source: seedPath, target: c.path, type: 'tag_based', label: c.sharedTags.join(', '), strength: Math.min(c.sharedTags.length, 5) });
        }
      }
      for (const c of candidates) {
        if (seedEra && c.era === seedEra && !edges.find(e => e.target === c.path)) {
          edges.push({ source: seedPath, target: c.path, type: 'era_based', label: 'Shared era: ' + seedEra, strength: 2 });
        }
      }
      for (const c of candidates) {
        const sharedLocs = c.sharedLocations || [];
        if (sharedLocs.length > 0 && !edges.find(e => e.target === c.path)) {
          edges.push({ source: seedPath, target: c.path, type: 'location_based', label: 'Shared location: ' + sharedLocs.join(', '), strength: 2 });
        }
      }

      const connectedPaths = new Set(edges.map(e => e.target));
      const visibleNodes = candidateNodes.filter(n => connectedPaths.has(n.id));

      res.json({ nodes: [seedNode, ...visibleNodes], edges, model: 'seed-based (no AI)', fileCount: visibleNodes.length + 1 });
    }
  } catch (error) {
    console.error('Graph generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
