import fs from 'fs';
import path from 'path';
import { getUserWorkspaceDir } from './authService.js';

/**
 * Knowledge Graph service for WORBI LLM agent tools.
 *
 * Each user has a per-workspace graph stored at:
 *   <workspace>/.worbi/graph.json
 *
 * Graph shape:
 * {
 *   "entities": {
 *     "EntityName": { "entityType": "Character", "observations": ["..."] }
 *   },
 *   "relations": [
 *     { "from": "A", "to": "B", "relationType": "knows" }
 *   ]
 * }
 */

const GRAPH_DIR = '.worbi';
const GRAPH_FILE = 'graph.json';

/**
 * Get the full path to a user's graph.json
 */
function getGraphPath(username) {
  const workspaceRoot = getUserWorkspaceDir(username);
  return path.join(workspaceRoot, GRAPH_DIR, GRAPH_FILE);
}

/**
 * Load the graph for a user. Creates an empty graph if it doesn't exist.
 */
function loadGraph(username) {
  const graphPath = getGraphPath(username);
  if (fs.existsSync(graphPath)) {
    try {
      return JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    } catch {
      // Corrupted file — start fresh
    }
  }
  return { entities: {}, relations: [] };
}

/**
 * Save the graph for a user.
 */
function saveGraph(username, graph) {
  const graphPath = getGraphPath(username);
  const dir = path.dirname(graphPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf-8');
}

/**
 * Get all entities.
 */
function getAllEntities(username) {
  const graph = loadGraph(username);
  return graph.entities || {};
}

/**
 * Get a single entity by name.
 */
function getEntity(username, name) {
  const graph = loadGraph(username);
  return graph.entities?.[name] || null;
}

/**
 * Search entities by query string (matches entity name, type, or observation content).
 */
function searchEntities(username, query) {
  const graph = loadGraph(username);
  const q = query.toLowerCase();
  const results = [];

  for (const [name, entity] of Object.entries(graph.entities || {})) {
    const nameMatch = name.toLowerCase().includes(q);
    const typeMatch = (entity.entityType || '').toLowerCase().includes(q);
    const obsMatch = (entity.observations || []).some(o => o.toLowerCase().includes(q));

    if (nameMatch || typeMatch || obsMatch) {
      results.push({ name, ...entity });
    }
  }

  return results;
}

/**
 * Get an entity and its connected neighbors up to a given depth.
 */
function getEntityConnections(username, name, depth = 1) {
  const graph = loadGraph(username);
  const entity = graph.entities?.[name];
  if (!entity) return null;

  const connected = new Set();
  let currentLevel = [name];

  for (let d = 0; d < depth; d++) {
    const nextLevel = new Set();
    for (const node of currentLevel) {
      for (const rel of graph.relations || []) {
        if (rel.from === node && rel.to !== node) {
          nextLevel.add(rel.to);
          connected.add(rel.to);
        }
        if (rel.to === node && rel.from !== node) {
          nextLevel.add(rel.from);
          connected.add(rel.from);
        }
      }
    }
    currentLevel = [...nextLevel];
  }

  const neighbors = {};
  for (const neighborName of connected) {
    if (graph.entities?.[neighborName]) {
      neighbors[neighborName] = graph.entities[neighborName];
    }
  }

  const relatedRelations = (graph.relations || []).filter(
    r => r.from === name || r.to === name
  );

  return {
    entity: { name, ...entity },
    neighbors,
    relations: relatedRelations,
  };
}

/**
 * Create a new entity. Returns error if entity already exists.
 */
function createEntity(username, name, entityType, observations = []) {
  const graph = loadGraph(username);
  if (!graph.entities) graph.entities = {};
  if (!graph.relations) graph.relations = [];

  if (graph.entities[name]) {
    return { success: false, error: `Entity "${name}" already exists` };
  }

  graph.entities[name] = { entityType, observations };
  saveGraph(username, graph);
  return { success: true, entity: { name, entityType, observations } };
}

/**
 * Add observations to an existing entity.
 */
function addObservations(username, entityName, contents = []) {
  const graph = loadGraph(username);
  if (!graph.entities?.[entityName]) {
    return { success: false, error: `Entity "${entityName}" not found` };
  }

  if (!graph.entities[entityName].observations) {
    graph.entities[entityName].observations = [];
  }

  const added = [];
  for (const obs of contents) {
    if (!graph.entities[entityName].observations.includes(obs)) {
      graph.entities[entityName].observations.push(obs);
      added.push(obs);
    }
  }

  saveGraph(username, graph);
  return { success: true, added };
}

/**
 * Delete entities and their associated relations.
 */
function deleteEntities(username, entityNames = []) {
  const graph = loadGraph(username);
  if (!graph.entities) graph.entities = {};
  if (!graph.relations) graph.relations = [];

  const deleted = [];
  for (const name of entityNames) {
    if (graph.entities[name]) {
      delete graph.entities[name];
      deleted.push(name);
    }
  }

  // Remove relations that reference deleted entities
  graph.relations = graph.relations.filter(
    r => !entityNames.includes(r.from) && !entityNames.includes(r.to)
  );

  saveGraph(username, graph);
  return { success: true, deleted };
}

/**
 * Delete specific observations from entities.
 */
function deleteObservations(username, deletions = []) {
  // deletions: [{ entityName, observations: [string] }]
  const graph = loadGraph(username);
  if (!graph.entities) graph.entities = {};

  const results = [];
  for (const del of deletions) {
    const entity = graph.entities?.[del.entityName];
    if (!entity) {
      results.push({ entityName: del.entityName, success: false, error: 'Entity not found' });
      continue;
    }

    const obsToDelete = del.observations || [];
    const before = entity.observations?.length || 0;
    entity.observations = (entity.observations || []).filter(o => !obsToDelete.includes(o));
    const after = entity.observations?.length || 0;

    results.push({ entityName: del.entityName, success: true, removed: before - after });
  }

  saveGraph(username, graph);
  return { success: true, results };
}

/**
 * Create a new relation between entities.
 */
function createRelation(username, from, to, relationType) {
  const graph = loadGraph(username);
  if (!graph.entities?.[from]) {
    return { success: false, error: `Entity "${from}" not found` };
  }
  if (!graph.entities?.[to]) {
    return { success: false, error: `Entity "${to}" not found` };
  }
  if (!graph.relations) graph.relations = [];

  // Check for duplicate
  const duplicate = graph.relations.find(
    r => r.from === from && r.to === to && r.relationType === relationType
  );
  if (duplicate) {
    return { success: false, error: 'Relation already exists' };
  }

  graph.relations.push({ from, to, relationType });
  saveGraph(username, graph);
  return { success: true, relation: { from, to, relationType } };
}

/**
 * Create multiple relations.
 */
function createRelations(username, relations = []) {
  const results = [];
  for (const rel of relations) {
    const result = createRelation(username, rel.from, rel.to, rel.relationType);
    results.push(result);
  }
  return { success: true, results };
}

/**
 * Delete specific relations.
 */
function deleteRelations(username, relations = []) {
  const graph = loadGraph(username);
  if (!graph.relations) graph.relations = [];

  let removed = 0;
  for (const rel of relations) {
    const idx = graph.relations.findIndex(
      r => r.from === rel.from && r.to === rel.to && r.relationType === rel.relationType
    );
    if (idx !== -1) {
      graph.relations.splice(idx, 1);
      removed++;
    }
  }

  saveGraph(username, graph);
  return { success: true, removed };
}

/**
 * Format graph data as a human-readable string for LLM responses.
 */
function formatGraph(graph) {
  const lines = [];

  if (graph.entities && Object.keys(graph.entities).length > 0) {
    lines.push('Entities:');
    for (const [name, entity] of Object.entries(graph.entities)) {
      lines.push(`  - ${name} (${entity.entityType})`);
      if (entity.observations && entity.observations.length > 0) {
        for (const obs of entity.observations) {
          lines.push(`    - ${obs}`);
        }
      }
    }
  }

  if (graph.relations && graph.relations.length > 0) {
    lines.push('\nRelations:');
    for (const rel of graph.relations) {
      lines.push(`  - ${rel.from} --[${rel.relationType}]--> ${rel.to}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : '(empty graph)';
}

export {
  loadGraph,
  saveGraph,
  getAllEntities,
  getEntity,
  searchEntities,
  getEntityConnections,
  createEntity,
  addObservations,
  deleteEntities,
  deleteObservations,
  createRelation,
  createRelations,
  deleteRelations,
  formatGraph,
};