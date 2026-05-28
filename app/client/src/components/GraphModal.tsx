import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import cytoscape, { ElementDefinition, ElementGroup, CytoscapeOptions } from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import { GraphNode, GraphEdge } from '../services/api';
import { X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Eye, Filter, X as XIcon } from 'lucide-react';

cytoscape.use(coseBilkent);

interface GraphModalProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  model: string;
  onClose: () => void;
  onNodeClick: (nodeId: string) => void;
}

// Cose-bilkent layout options type
interface CoseBilkentOptions {
  name: 'cose-bilkent';
  animate?: 'during' | false;
  animationDuration?: number;
  refresh?: number;
  nodeDimensionsIncludeLabels?: boolean;
  idealEdgeLength?: number;
  nodeOverlap?: number;
  gravity?: number;
  numIter?: number;
  wiringRadius?: number;
}

const GraphModal: React.FC<GraphModalProps> = ({ nodes, edges, model, onClose, onNodeClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [nodeCount, setNodeCount] = useState(nodes.length);
  const [edgeCount, setEdgeCount] = useState(edges.length);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [hiddenEdgeTypes, setHiddenEdgeTypes] = useState<Set<string>>(new Set());
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [minStrength, setMinStrength] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;

    // Build a label fallback map from file paths
    const idToLabel = new Map(nodes.map(n => [n.id, n.label || n.id]));

    // Normalize node IDs to include .html extension for matching
    function normalizeId(id: string): string {
      return id.endsWith('.html') ? id : `${id}.html`;
    }

    // Derive display name from file path
    function pathToName(filePath: string): string {
      if (!filePath) return '';
      return filePath.replace(/\.html$/, '').split('/').pop() || filePath;
    }

    const nodeElements: ElementDefinition[] = nodes.map(n => {
      const nodeId = n.id;

       // Validate label: reject Cytoscape expressions, undefined, or empty strings
       let labelText = n.label;
       if (!labelText || typeof labelText !== 'string' || labelText.trim() === '' || labelText.includes('data(')) {
         // Fallback: derive label from the file path
         labelText = pathToName(nodeId);
       }

       // FINAL SAFETY: ensure label is a non-empty string
       if (!labelText || labelText.trim() === '') {
         labelText = 'Unknown';
       }

        const tagsStr = (n.tags || []).join(', ') || 'none';
        const eraStr = n.era || '';
        const dateStr = n.date || '';

        // Debug: log first node to verify data shape
        if (nodes.indexOf(n) === 0) {
          console.log('[GraphModal] First node raw data:', JSON.stringify(n, null, 2));
          console.log('[GraphModal] First node mapped data:', { id: nodeId, label: labelText, color: n.color, size: n.size, tags: tagsStr, era: eraStr, date: dateStr });
        }

        // Log all nodes with empty labels (should not happen after fix)
        if (!n.label || typeof n.label !== 'string' || n.label.trim() === '') {
          console.warn('[GraphModal] Node with empty label, using fallback:', { nodeId, fallback: labelText });
        }

        return {
          group: 'nodes' as ElementDefinition['group'],
          data: {
            id: nodeId,
            label: labelText,
           color: n.color || '#6b7280',
           size: n.size || 8,
           tags: tagsStr,
           era: eraStr,
           date: dateStr,
         },
       };
    });

    const edgeElements: ElementDefinition[] = edges.map(e => {
      const sourceId = e.source;
      const targetId = e.target;
      return {
        group: 'edges' as ElementDefinition['group'],
        data: {
          id: `e_${sourceId}_${targetId}_${e.type}`,
          source: sourceId,
          target: targetId,
          type: e.type || 'tag_based',
          label: e.label || `${e.type}`,
          strength: e.strength || 1,
        },
      };
    });

    const options: CytoscapeOptions = {
      container: containerRef.current,
      elements: [...nodeElements, ...edgeElements],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'font-size': '10px',
            'font-weight': 500,
            'color': '#e0e0e0',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 5,
            'width': 'mapData(size, 5, 20, 15px, 40px)',
            'height': 'mapData(size, 5, 20, 15px, 40px)',
            'border-width': 2,
            'border-color': '#1a1a2e',
            'shadow-blur': '8px',
            'shadow-color': 'data(color)',
            'shadow-opacity': 0.3,
            'shape': 'ellipse',
            'text-wrap': 'wrap',
            'text-max-width': 80,
          } as any,
        },
        {
          selector: 'node:active',
          style: {
            'border-width': 3,
            'border-color': '#a78bfa',
            'shadow-opacity': 0.6,
          } as any,
        },
        {
          selector: 'node:hover',
          style: {
            'border-width': 3,
            'border-color': '#ffffff',
          } as any,
        },
        {
          selector: 'edge',
          style: {
            'width': 'mapData(strength, 1, 5, 1, 4)',
            'line-color': '#555',
            'target-arrow-color': '#555',
            'target-arrow-shape': 'none',
            'label': 'data(label)',
            'font-size': '9px',
            'color': '#888',
            'text-rotation': 'autorotate',
            'text-margin-y': -3,
            'opacity': 0.6,
          } as any,
        },
        {
          selector: 'edge[type="tag_based"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#6b7280',
            'target-arrow-color': '#6b7280',
            'opacity': 0.4,
          } as any,
        },
        {
          selector: 'edge[type="character_connection"]',
          style: {
            'line-style': 'solid',
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'opacity': 0.7,
          } as any,
        },
        {
          selector: 'edge[type="location_connection"]',
          style: {
            'line-style': 'solid',
            'line-color': '#22c55e',
            'target-arrow-color': '#22c55e',
            'opacity': 0.7,
          } as any,
        },
        {
          selector: 'edge[type="thematic"]',
          style: {
            'line-style': 'solid',
            'line-color': '#a78bfa',
            'target-arrow-color': '#a78bfa',
            'opacity': 0.7,
          } as any,
        },
        {
          selector: 'edge[type="narrative"]',
          style: {
            'line-style': 'solid',
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
            'opacity': 0.7,
          } as any,
        },
        {
          selector: 'edge:hover',
          style: {
            'opacity': 1,
            'width': 'mapData(strength, 1, 5, 2, 5)',
            'label': 'data(label)',
          } as any,
        },
      ],
      layout: {
        name: 'cose-bilkent',
        animate: nodes.length < 100 ? 'during' : false,
        animationDuration: 1000,
        refresh: 20,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 100,
        nodeOverlap: 20,
        gravity: 0.2,
        numIter: 1000,
        wiringRadius: 20,
      } as CoseBilkentOptions,
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.2,
    };

    const cy = cytoscape(options);
    cyRef.current = cy;

    // Click node -> open document
    cy.on('tap', 'node', function (evt) {
      const node = evt.target;
      const nodeId = node.id();
      onNodeClick(nodeId);
    });

    // Hover events for tooltip
    cy.on('mouseover', 'node', function (evt) {
      const node = evt.target;
      const renderPos = node.renderedPosition();
      const parts: string[] = [];
      parts.push(node.data('label'));
      const era = node.data('era');
      const date = node.data('date');
      if (era || date) {
        const timelineStr = [era, date].filter(Boolean).join(' ');
        parts.push('Timeline: ' + timelineStr);
      }
      const tags = node.data('tags');
      if (tags) {
        parts.push('Tags: ' + tags);
      }
      const content = parts.join('\n');
      setTooltip({
        x: renderPos.x + 20,
        y: renderPos.y - 10,
        content,
      });
    });

    cy.on('mouseout', 'node', () => {
      setTooltip(null);
    });

    cy.on('mouseover', 'edge', function (evt) {
      const edge = evt.target;
      const renderPos = edge.renderedPosition();
      const content = edge.data('label')
        ? `${edge.data('label')}\n(${edge.data('type')}, strength: ${edge.data('strength')})`
        : `${edge.data('type')} (${edge.data('strength')})`;
      setTooltip({
        x: renderPos.x + 10,
        y: renderPos.y - 10,
        content,
      });
    });

    cy.on('mouseout', 'edge', () => {
      setTooltip(null);
    });

    // Update counts after layout
    (cy as any).once('layoutready', () => {
      setNodeCount(cy.nodes().length);
      setEdgeCount(cy.edges().length);
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [nodes, edges, onNodeClick]);

  // Apply filters to Cytoscape graph using hide/show
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Build set of nodes to hide based on tag filters and search
    const nodesToHide = new Set<string>();

    // Tag-based filtering (case-sensitive to match data)
    if (hiddenTags.size > 0) {
      cy.nodes().forEach((node: any) => {
        const nodeTags = (node.data('tags') || 'none').split(',').map((t: string) => t.trim());
        const hasHiddenTag = nodeTags.some((tag: string) => hiddenTags.has(tag));
        if (hasHiddenTag) {
          nodesToHide.add(node.id());
        }
      });
    }

    // Search-based filtering
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      cy.nodes().forEach((node: any) => {
        const label = (node.data('label') || '').toLowerCase();
        const id = (node.data('id') || '').toLowerCase();
        const tags = (node.data('tags') || '').toLowerCase();
        const matches = label.includes(query) || id.includes(query) || tags.includes(query);
        if (!matches) {
          nodesToHide.add(node.id());
        }
      });
    }

    // Apply node visibility via styled cytoscape API
    cy.nodes().forEach((node: any) => {
      if (nodesToHide.has(node.id())) {
        (node as any).hide();
      } else {
        (node as any).show();
      }
    });

    // Edge type filtering
    if (hiddenEdgeTypes.size > 0) {
      cy.edges().forEach((edge: any) => {
        const edgeType = edge.data('type') || 'tag_based';
        if (hiddenEdgeTypes.has(edgeType)) {
          (edge as any).hide();
        } else {
          (edge as any).show();
        }
      });
    } else {
      cy.edges().forEach((edge: any) => {
        (edge as any).show();
      });
    }

    // Minimum strength filtering
    if (minStrength > 1) {
      cy.edges().forEach((edge: any) => {
        const strength = edge.data('strength') || 1;
        if (strength < minStrength) {
          (edge as any).hide();
        }
      });
    }
  }, [hiddenEdgeTypes, hiddenTags, searchQuery, minStrength]);

  // Handle container resize
  const handleFit = useCallback(() => {
    if (cyRef.current) {
      (cyRef.current as any).fit(40);
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    if (cyRef.current) {
      const cy = cyRef.current as any;
      const center = cy.center();
      cy.zoom({ level: cy.zoom() * 1.2, renderedPosition: center });
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (cyRef.current) {
      const cy = cyRef.current as any;
      const center = cy.center();
      cy.zoom({ level: cy.zoom() * 0.8, renderedPosition: center });
    }
  }, []);

  const handleRelayout = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.layout({
        name: 'cose-bilkent',
        animate: nodeCount < 100 ? 'during' : false,
        animationDuration: 1000,
        idealEdgeLength: 100,
        nodeOverlap: 20,
        gravity: 0.2,
        numIter: 1000,
      } as CoseBilkentOptions).run();
    }
  }, [nodeCount]);

  // Derive available edge types and tags from data
  const availableEdgeTypes = useMemo(() => {
    const types = new Set<string>();
    edges.forEach(e => {
      const t = e.type || 'tag_based';
      types.add(t);
    });
    return Array.from(types).sort();
  }, [edges]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    nodes.forEach(n => {
      (n.tags || []).forEach(tag => {
        tags.add(tag);
      });
    });
    return Array.from(tags).sort();
  }, [nodes]);

  const edgeTypeColors: Record<string, string> = {
    'tag_based': '#6b7280',
    'character_connection': '#f59e0b',
    'location_connection': '#22c55e',
    'thematic': '#a78bfa',
    'narrative': '#3b82f6',
    'time_connection': '#38bdf8',
  };

  const tagColors: Record<string, string> = {
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

  const getTagColor = (tag: string): string => {
    return tagColors[tag] || '#a78bfa';
  };

  // Count visible elements
  const visibleNodesCount = useMemo(() => {
    if (hiddenTags.size === 0 && searchQuery.trim() === '') return nodes.length;
    let count = 0;
    nodes.forEach(n => {
      const nodeTags = (n.tags || []).map(t => t);
      const hasHiddenTag = nodeTags.some(tag => hiddenTags.has(tag));
      if (hasHiddenTag) return;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const label = (n.label || '').toLowerCase();
        const id = (n.id || '').toLowerCase();
        const tags = (n.tags || []).join(', ').toLowerCase();
        if (!label.includes(query) && !id.includes(query) && !tags.includes(query)) return;
      }
      count++;
    });
    return count;
  }, [nodes, hiddenTags, searchQuery]);

  const hiddenNodesCount = nodes.length - visibleNodesCount;

  const toggleEdgeType = (type: string) => {
    setHiddenEdgeTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setHiddenTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setHiddenEdgeTypes(new Set());
    setHiddenTags(new Set());
    setSearchQuery('');
    setMinStrength(1);
  };

  const hasActiveFilters = hiddenEdgeTypes.size > 0 || hiddenTags.size > 0 || searchQuery.trim() !== '' || minStrength > 1;

  // Fit on maximize
  useEffect(() => {
    if (isMaximized) {
      setTimeout(handleFit, 100);
    }
  }, [isMaximized, handleFit]);

  // Initial fit
  useEffect(() => {
    if (nodes.length > 0 && !isMaximized) {
      setTimeout(handleFit, 500);
    }
  }, [nodes.length, isMaximized, handleFit]);

  return (
    <div
      className={`fixed rounded-xl border border-[#3a3a4a] bg-[#1a1a2e] flex flex-col overflow-hidden transition-all ${
        isMaximized
          ? 'inset-2 z-[100]'
          : 'inset-8 z-[90] max-w-4xl max-h-[80vh] mx-auto my-auto'
      }`}
      style={{ minWidth: '600px', minHeight: '500px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a4a] bg-[#1e1e2e]">
        <div>
          <h3 className="font-semibold text-sm text-[#e0e0e0]">Relationship Graph</h3>
          <p className="text-[11px] text-[#888]">
            Nodes: {nodeCount} | Edges: {edgeCount}
            {model && ` | Model: ${model}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded hover:bg-[#2a2a3a] text-[#e0e0e0] transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={handleFit}
            className="p-1.5 rounded hover:bg-[#2a2a3a] text-[#e0e0e0] transition-colors"
            title="Fit to screen"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={handleRelayout}
            className="p-1.5 rounded hover:bg-[#2a2a3a] text-[#e0e0e0] transition-colors"
            title="Re-layout"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#2a2a3a] text-[#e0e0e0] hover:text-red-400 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#3a3a4a] bg-[#1e1e2e]">
        <button
          onClick={handleZoomIn}
          className="p-1 rounded hover:bg-[#2a2a3a] text-[#e0e0e0] transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1 rounded hover:bg-[#2a2a3a] text-[#e0e0e0] transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleFit}
          className="p-1 rounded hover:bg-[#2a2a3a] text-[#e0e0e0] transition-colors"
          title="Fit to screen"
        >
          <Eye size={14} />
        </button>
        {/* Filter Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-1 rounded transition-colors relative ${
            hasActiveFilters
              ? 'bg-[#a78bfa]/20 text-[#a78bfa]'
              : 'hover:bg-[#2a2a3a] text-[#e0e0e0]'
          }`}
          title="Toggle filters"
        >
          <Filter size={14} />
          {hasActiveFilters && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#a78bfa]" />
          )}
        </button>

        <div className="flex-1" />
        <span className="text-[11px] text-[#888]">
          Click node to open &middot; Drag to rearrange &middot; Scroll to zoom
        </span>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-3 py-2 border-b border-[#3a3a4a] bg-[#1a1a2e] space-y-2">
          {/* Filter Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#888] uppercase tracking-wider">Filters</span>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <span className="text-[10px] text-[#a78bfa]">
                  {hiddenNodesCount > 0 ? `${hiddenNodesCount} nodes hidden` : ''}
                  {hiddenEdgeTypes.size > 0 ? ` · ${hiddenEdgeTypes.size} edge type(s)` : ''}
                </span>
              )}
              <button
                onClick={resetFilters}
                className="text-[10px] text-[#888] hover:text-[#e0e0e0] transition-colors flex items-center gap-1"
              >
                <XIcon size={10} />
                Reset
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#888] w-16 flex-shrink-0">Search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter nodes by name or tag..."
              className="flex-1 bg-[#2a2a3a] border border-[#3a3a4a] rounded px-2 py-1 text-xs text-[#e0e0e0] placeholder:text-[#555] focus:outline-none focus:border-[#a78bfa]/50"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#888] hover:text-[#e0e0e0]">
                <XIcon size={12} />
              </button>
            )}
          </div>

          {/* Min Strength */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#888] w-16 flex-shrink-0">Strength</span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={minStrength}
              onChange={e => setMinStrength(parseInt(e.target.value))}
              className="flex-1 accent-[#a78bfa]"
            />
            <span className="text-[10px] text-[#888] w-6">{minStrength}+</span>
          </div>

          {/* Edge Type Toggles */}
          <div>
            <span className="text-[11px] text-[#888] w-16 flex-shrink-0 inline-block">Edges</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {availableEdgeTypes.map(type => {
                const isHidden = hiddenEdgeTypes.has(type);
                const color = edgeTypeColors[type] || '#6b7280';
                const label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <button
                    key={type}
                    onClick={() => toggleEdgeType(type)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                      isHidden
                        ? 'bg-[#1a1a2e] text-[#555] line-through'
                        : 'bg-[#2a2a3a] text-[#e0e0e0] hover:bg-[#3a3a4a]'
                    }`}
                  >
                    <span className="w-2 h-0.5 rounded" style={{ backgroundColor: color }} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tag Toggles */}
          {availableTags.length > 0 && (
            <div>
              <span className="text-[11px] text-[#888] w-16 flex-shrink-0 inline-block">Tags</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {availableTags.map(tag => {
                  const isHidden = hiddenTags.has(tag);
                  const color = getTagColor(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                        isHidden
                          ? 'bg-[#1a1a2e] text-[#555] line-through'
                          : 'bg-[#2a2a3a] text-[#e0e0e0] hover:bg-[#3a3a4a]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Graph Canvas */}
      <div className="flex-1 relative bg-[#12121f]">
        <div ref={containerRef} className="w-full h-full" />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-50 px-3 py-2 rounded-md bg-[#1e1e2e] border border-[#3a3a4a] text-xs text-[#e0e0e0] shadow-lg whitespace-pre-line"
            style={{ left: tooltip.x, top: tooltip.y, maxWidth: '250px' }}
          >
            {tooltip.content}
          </div>
        )}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[#888]">
            <div className="text-center">
              <p className="text-sm">No documents found</p>
              <p className="text-[11px] mt-1">Tag your documents to create connections</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-[#3a3a4a] bg-[#1e1e2e] text-[11px] text-[#888]">
        <span>Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#f59e0b] rounded" />
          Character
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#22c55e] rounded" />
          Location
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#a78bfa] rounded" />
          Thematic
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#3b82f6] rounded" />
          Narrative
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t border-dashed border-[#6b7280]" />
          Tag
        </span>
      </div>
    </div>
  );
};

export default GraphModal;