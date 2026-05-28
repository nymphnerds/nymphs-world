import { useState, useCallback } from 'react';
import { useGraph } from '../../hooks/useGraph';
import type { GraphNode, GraphEdge } from '../../services/api';

/**
 * Manages graph modal state and graph operations.
 * Wraps useGraph hook + graphModalData state to reduce App.tsx complexity.
 */
export function useGraphManager(username: string | undefined) {
  const [graphModalData, setGraphModalData] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    model: string;
  } | null>(null);

  const graph = useGraph(username);

  const handleGenerate = useCallback(
    async (seedPath: string, relTypes: string[], useAI: boolean, depth?: 1 | 2) => {
      const result = await graph.generate(seedPath, relTypes, useAI, depth);
      if (result) {
        const entry = graph.restoreCache();
        if (entry?.data) {
          setGraphModalData({
            nodes: entry.data.nodes,
            edges: entry.data.edges,
            model: entry.data.model || '',
          });
        }
      }
    },
    [graph],
  );

  const handleViewCached = useCallback(() => {
    const entry = graph.restoreCache();
    if (entry?.data) {
      setGraphModalData({
        nodes: entry.data.nodes,
        edges: entry.data.edges,
        model: entry.data.model || '',
      });
    }
  }, [graph]);

  const handleClear = useCallback(() => {
    graph.clearCache();
    setGraphModalData(null);
  }, [graph]);

  const handleOpenGraph = useCallback(() => {
    const entry = graph.restoreCache();
    if (entry?.data) {
      setGraphModalData({
        nodes: entry.data.nodes,
        edges: entry.data.edges,
        model: '',
      });
    }
  }, [graph]);

  const handleCloseModal = useCallback(() => {
    setGraphModalData(null);
  }, []);

  return {
    graphModalData,
    setGraphModalData,
    loading: graph.loading,
    error: graph.error,
    hasCache: graph.hasCache(),
    handleGenerate,
    handleViewCached,
    handleClear,
    handleOpenGraph,
    handleCloseModal,
  };
}