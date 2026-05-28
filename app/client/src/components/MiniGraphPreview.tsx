import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, ExternalLink } from 'lucide-react';
import { GraphNode, GraphEdge } from '../services/api';

function getCacheKey(username?: string | null): string {
  if (username) return `wbu_cumulative_graph_${username}`;
  return 'wbu_graph_cache_anon';
}

interface GraphCacheEntry {
  data: { nodes: GraphNode[]; edges: GraphEdge[]; model?: string };
  timestamp: number;
}

interface MiniGraphPreviewProps {
  currentPath: string | null;
  onOpenGraph: () => void;
  username?: string | null;
}

function normalizeId(id: string): string {
  return id.endsWith('.html') ? id : `${id}.html`;
}

// Get a deterministic color from a tag name
function getTagColor(tag: string): string {
  const colors: Record<string, string> = {
    'Character': '#a78bfa',
    'NPC': '#f472b6',
    'Location': '#34d399',
    'Plot': '#fbbf24',
    'Magic': '#60a5fa',
    'Faction': '#f87171',
    'Item': '#fb923c',
    'Event': '#c084fc',
    'World': '#2dd4bf',
    'Timeline': '#38bdf8',
  };
  return colors[tag] || '#a78bfa';
}

function getEdgeColor(type: string): string {
  const colors: Record<string, string> = {
    'related': '#6b7280',
    'character': '#a78bfa',
    'location': '#34d399',
    'plot': '#fbbf24',
    'timeline': '#38bdf8',
    'family': '#f472b6',
    'friendship': '#60a5fa',
    'conflict': '#f87171',
  };
  return colors[type?.toLowerCase()] || '#6b7280';
}

export function MiniGraphPreview({ currentPath, onOpenGraph, username }: MiniGraphPreviewProps) {
  const [cache, setCache] = useState<GraphCacheEntry | null>(null);

  const cacheKey = useMemo(() => getCacheKey(username), [username]);

  const loadCache = useCallback((): GraphCacheEntry | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch { /* ignore */ }
    return null;
  }, [cacheKey]);

  useEffect(() => {
    setCache(loadCache());

    const handler = () => setCache(loadCache());
    window.addEventListener('storage', handler);

    // Same-tab polling (storage event doesn't fire in same tab)
    const interval = setInterval(() => setCache(loadCache()), 2000);

    // Also refresh when currentPath changes
    return () => {
      window.removeEventListener('storage', handler);
      clearInterval(interval);
    };
  }, [currentPath, loadCache]);

  const focusData = useMemo(() => {
    if (!cache || !currentPath) return null;

    const nodes = cache.data.nodes;
    const edges = cache.data.edges;
    const targetId = normalizeId(currentPath);

    // Find the focus node
    const focusNode = nodes.find(n => normalizeId(n.id) === targetId);
    if (!focusNode) return null;

    // Find connected node IDs
    const connectedIds = new Set<string>();
    const connectedEdges = edges.filter(e => {
      const srcMatch = normalizeId(e.source) === targetId;
      const tgtMatch = normalizeId(e.target) === targetId;
      if (srcMatch || tgtMatch) {
        connectedIds.add(normalizeId(e.source));
        connectedIds.add(normalizeId(e.target));
        return true;
      }
      return false;
    });

    const connectedNodes = nodes.filter(n => connectedIds.has(normalizeId(n.id)));

    return {
      focusNode,
      connectedNodes,
      connectedEdges,
      totalNodes: nodes.length,
      totalEdges: edges.length,
    };
  }, [cache, currentPath]);

  if (!cache) {
    return (
      <div
        className="flex flex-col items-center justify-center py-3 cursor-pointer group"
        onClick={onOpenGraph}
      >
        <Link size={14} className="text-muted-foreground/20 mb-1" />
        <span className="text-[9px] text-muted-foreground/20 italic">No graph generated yet</span>
      </div>
    );
  }

  if (!focusData) {
    return (
      <div
        className="flex flex-col items-center justify-center py-3 cursor-pointer group"
        onClick={onOpenGraph}
      >
        <div className="flex items-center gap-1 mb-1">
          <div className="w-2 h-2 rounded-full bg-primary/40" />
          <span className="text-[9px] text-muted-foreground/40">
            {cache.data.nodes.length} nodes · {cache.data.edges.length} connections
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground/30 italic group-hover:text-primary/60 transition-colors">
          Click to view full graph
        </span>
      </div>
    );
  }

  // Mini SVG layout: focus node in center, connected nodes arranged in a circle
  const svgWidth = 260;
  const svgHeight = 110;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const radius = 36;
  const focusRadius = 10;
  const nodeRadius = 6;

  const positions = focusData.connectedNodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / focusData.connectedNodes.length - Math.PI / 2;
    return {
      node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  return (
    <div
      className="flex flex-col items-center justify-center py-1.5 cursor-pointer group"
      onClick={onOpenGraph}
      title="Click to view full relationship graph"
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full max-w-xs"
      >
        {/* Edges */}
        {focusData.connectedEdges.map((edge, i) => {
          const sourcePos = positions.find(p => normalizeId(p.node.id) === normalizeId(edge.source));
          const targetPos = positions.find(p => normalizeId(p.node.id) === normalizeId(edge.target));
          if (!sourcePos || !targetPos) return null;

          const edgeColor = getEdgeColor(edge.type || '');

          return (
            <line
              key={i}
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke={edgeColor}
              strokeWidth={1}
              strokeDasharray="3 2"
              opacity={0.5}
            />
          );
        })}

        {/* Focus node connections */}
        {positions.map((pos, i) => {
          const edge = focusData.connectedEdges[i];
          const edgeColor = getEdgeColor(edge?.type || '');
          return (
            <line
              key={`focus-${i}`}
              x1={centerX}
              y1={centerY}
              x2={pos.x}
              y2={pos.y}
              stroke={edgeColor}
              strokeWidth={1.2}
              opacity={0.6}
            />
          );
        })}

        {/* Connected nodes */}
        {positions.map((pos, i) => {
          const firstTag = pos.node.tags?.[0] || '';
          const color = pos.node.color || getTagColor(firstTag);
          return (
            <g key={`node-${i}`}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={nodeRadius}
                fill={color}
                opacity={0.8}
                className="group-hover:opacity-100 transition-opacity"
              />
              <text
                x={pos.x}
                y={pos.y + nodeRadius + 8}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize={7}
                className="pointer-events-none"
              >
                {pos.node.label?.length > 8 ? pos.node.label.slice(0, 7) + '…' : pos.node.label}
              </text>
            </g>
          );
        })}

        {/* Focus node (center, larger, purple) */}
        <circle
          cx={centerX}
          cy={centerY}
          r={focusRadius}
          fill="#a78bfa"
          stroke="#c4b5fd"
          strokeWidth={1.5}
          className="group-hover:r-[12] transition-all"
        />
        <text
          x={centerX}
          y={centerY + focusRadius + 10}
          textAnchor="middle"
          fill="#e5e7eb"
          fontSize={8}
          fontWeight="bold"
        >
          {focusData.focusNode.label?.length > 8
            ? focusData.focusNode.label.slice(0, 7) + '…'
            : focusData.focusNode.label}
        </text>
      </svg>

      {/* Stats */}
      <div className="flex items-center gap-2 mt-0.5">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
          <span className="text-[8px] text-muted-foreground/40">
            {focusData.connectedNodes.length} connected of {focusData.totalNodes} total
          </span>
        </div>
        <div className="flex items-center gap-0.5 text-muted-foreground/20 group-hover:text-primary/50 transition-colors">
          <ExternalLink size={8} />
          <span className="text-[8px]">View full</span>
        </div>
      </div>
    </div>
  );
}