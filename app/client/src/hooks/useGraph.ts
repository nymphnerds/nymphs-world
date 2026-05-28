import { useState, useCallback } from 'react';
import {
  generateGraphFromSeed,
  GraphData,
  GraphNode,
  GraphEdge,
  SeedGraphPayload,
} from '../services/api';

function getCacheKey(username: string): string {
  return `wbu_cumulative_graph_${username}`;
}

export interface GraphMergeStats {
  isNew: boolean;
  newNodes: number;
  newEdges: number;
  totalNodes: number;
  totalEdges: number;
}

export interface GraphCacheEntry {
  data: GraphData;
  timestamp: number;
}

export function useGraph(username?: string | null) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = username ? getCacheKey(username || '') : `wbu_graph_cache_v8_seed_anon`;

  // Load cached graph from localStorage, with migration from anonymous key
  const loadCache = useCallback((): GraphCacheEntry | null => {
    try {
      let cached = localStorage.getItem(cacheKey);
      // Migration: if no username-scoped cache exists, try anonymous key
      if (!cached && username) {
        const anonKey = 'wbu_graph_cache_v8_seed_anon';
        const anonCached = localStorage.getItem(anonKey);
        if (anonCached) {
          localStorage.setItem(cacheKey, anonCached);
          cached = anonCached;
        }
      }
      if (cached) {
        const entry = JSON.parse(cached);
        // Validate cached data has proper labels before returning
        if (entry.data?.nodes) {
          for (const n of entry.data.nodes) {
            if (!n.label || typeof n.label !== 'string' || n.label.trim() === '') {
              n.label = n.id?.replace(/\.html$/, '').split('/').pop() || 'Unknown';
            }
          }
        }
        return entry;
      }
    } catch {
      // Corrupt cache, ignore
    }
    return null;
  }, [cacheKey, username]);

  // Save graph data to cache
  const saveCache = useCallback(
    (data: GraphData) => {
      try {
        const entry: GraphCacheEntry = {
          data,
          timestamp: Date.now(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(entry));
      } catch {
        // Storage full, ignore
      }
    },
    [cacheKey]
  );

  // Clear cached graph
  const clearCache = useCallback(() => {
    localStorage.removeItem(cacheKey);
    setGraphData(null);
  }, [cacheKey]);

  // Check if cache exists
  const hasCache = useCallback((): boolean => {
    return loadCache() !== null;
  }, [loadCache]);

  // Restore cached graph to state
  const restoreCache = useCallback((): GraphCacheEntry | null => {
    const entry = loadCache();
    if (entry) {
      setGraphData(entry.data);
    }
    return entry;
  }, [loadCache]);

  // Merge new graph data into existing cumulative graph, deduplicating nodes/edges
  const mergeGraph = (existing: GraphData, incoming: GraphData): GraphData => {
    const existingNodePaths = new Set(existing.nodes.map(n => n.id));
    const existingEdgeKeys = new Set(existing.edges.map(e => `${e.source}||${e.target}||${e.type}`));

    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];

    for (const node of incoming.nodes) {
      if (!existingNodePaths.has(node.id)) {
        newNodes.push(node);
        existingNodePaths.add(node.id);
      }
    }

    for (const edge of incoming.edges) {
      const key = `${edge.source}||${edge.target}||${edge.type}`;
      if (!existingEdgeKeys.has(key)) {
        newEdges.push(edge);
        existingEdgeKeys.add(key);
      }
    }

    return {
      nodes: [...existing.nodes, ...newNodes],
      edges: [...existing.edges, ...newEdges],
      model: existing.model,
    };
  };

  // Generate seed-centric graph and merge into cumulative graph
  const genGraph = useCallback(
    async (
      seedPath: string,
      relationshipTypes: string[] = [],
      useAI: boolean = false,
      depth: 1 | 2 = 1,
    ) => {
      if (!seedPath) {
        setError('No document selected as graph seed. Open a document first.');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const payload: SeedGraphPayload = {
          seedPath,
          relationshipTypes,
          useAI,
          depth,
        };

        const result = await generateGraphFromSeed(payload);

        // Load existing cumulative graph
        const cached = loadCache();

        if (cached) {
          // Merge new data into existing cumulative graph
          const merged = mergeGraph(cached.data, result);
          setGraphData(merged);
          saveCache(merged);
        } else {
          // First graph generation
          setGraphData(result);
          saveCache(result);
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate graph';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [saveCache, loadCache],
  );

  return {
    graphData,
    loading,
    error,
    hasCache,
    restoreCache,
    clearCache,
    generate: genGraph,
  };
}