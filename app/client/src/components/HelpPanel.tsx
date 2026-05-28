import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  X, Search, ChevronRight, ChevronDown, FileText, Link as LinkIcon,
  Keyboard, ArrowLeft
} from 'lucide-react';
import {
  HELP_CATEGORIES,
  getArticleById,
  getCategoryForArticle,
  searchArticles,
  formatShortcut,
  type HelpArticle,
  type HelpCategory,
} from '../data/help-content';

interface HelpPanelProps {
  onClose: () => void;
  initialArticleId?: string;
}

type ViewMode = 'browse' | 'article' | 'search';

export function HelpPanel({ onClose, initialArticleId }: HelpPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialArticleId ? 'article' : 'browse');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(initialArticleId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(HELP_CATEGORIES.map(c => c.id))
  );
  const [breadcrumb, setBreadcrumb] = useState<{ category: string; article: string } | null>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchArticles(searchQuery);
  }, [searchQuery]);

  const selectedArticle = selectedArticleId ? getArticleById(selectedArticleId) : null;
  const selectedCategory = selectedArticleId ? getCategoryForArticle(selectedArticleId) : null;

  // Set initial article
  useEffect(() => {
    if (initialArticleId) {
      setSelectedArticleId(initialArticleId);
      setViewMode('article');
      const cat = getCategoryForArticle(initialArticleId);
      if (cat) {
        const art = getArticleById(initialArticleId);
        if (art) {
          setBreadcrumb({ category: cat.name, article: art.title });
        }
      }
    }
  }, [initialArticleId]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewMode === 'article') {
          setViewMode('browse');
          setSelectedArticleId(null);
          setBreadcrumb(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, onClose]);

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  }, []);

  const selectArticle = useCallback((articleId: string) => {
    setSelectedArticleId(articleId);
    setViewMode('article');
    const cat = getCategoryForArticle(articleId);
    const art = getArticleById(articleId);
    if (cat && art) {
      setBreadcrumb({ category: cat.name, article: art.title });
    }
  }, []);

  const goBack = useCallback(() => {
    setViewMode('browse');
    setSelectedArticleId(null);
    setBreadcrumb(null);
  }, []);

  const goToFileSearch = useCallback(() => {
    setViewMode('search');
    setSelectedArticleId(null);
    setBreadcrumb(null);
  }, []);

  // Render markdown-like content
  const renderContent = useCallback((content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let inCodeBlock = false;
    let listBuffer: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let inTable = false;
    let tableRows: string[][] = [];

    function flushList() {
      if (listBuffer.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={`list-${elements.length}`} className="list-inside my-2 space-y-0.5">
            {listBuffer.map((item, i) => (
              <li key={i} className="text-[13px] text-[#c0c0c0] leading-relaxed pl-4">
                {renderInline(item)}
              </li>
            ))}
          </ListTag>
        );
        listBuffer = [];
        listType = null;
      }
    }

    function flushTable() {
      if (tableRows.length > 0) {
        elements.push(
          <div key={`table-${elements.length}`} className="my-3 overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr>
                  {tableRows[0].map((cell, i) => (
                    <th key={i} className="px-3 py-2 text-left text-[#a0a0b0] border-b border-[#3a3a4a] font-medium">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-[#c0c0c0] border-b border-[#2a2a3a]">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    }

    function renderInline(text: string): React.ReactNode {
      // Simple inline rendering: **bold**, `code`, *italic*
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let keyIdx = 0;

      while (remaining.length > 0) {
        // Bold
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        const codeMatch = remaining.match(/`(.+?)`/);
        const italicMatch = remaining.match(/\*(.+?)\*/);

        let firstMatch: { type: string; start: number; end: number; content: string; } | null = null;

        if (boldMatch && boldMatch.index !== undefined) {
          firstMatch = { type: 'bold', start: boldMatch.index, end: boldMatch.index + boldMatch[0].length, content: boldMatch[1] };
        }
        if (codeMatch && codeMatch.index !== undefined && (!firstMatch || codeMatch.index < firstMatch.start)) {
          firstMatch = { type: 'code', start: codeMatch.index, end: codeMatch.index + codeMatch[0].length, content: codeMatch[1] };
        }
        if (italicMatch && italicMatch.index !== undefined && (!firstMatch || italicMatch.index < firstMatch.start)) {
          firstMatch = { type: 'italic', start: italicMatch.index, end: italicMatch.index + italicMatch[0].length, content: italicMatch[1] };
        }

        if (!firstMatch) {
          parts.push(<span key={keyIdx++}>{remaining}</span>);
          break;
        }

        // Text before match
        if (firstMatch.start > 0) {
          parts.push(<span key={keyIdx++}>{remaining.substring(0, firstMatch.start)}</span>);
        }

        // Render matched element
        switch (firstMatch.type) {
          case 'bold':
            parts.push(<strong key={keyIdx++} className="text-white font-semibold">{firstMatch.content}</strong>);
            break;
          case 'code':
            parts.push(
              <code key={keyIdx++} className="px-1.5 py-0.5 bg-[#2a2a3a] rounded text-[12px] text-purple-300 font-mono">
                {firstMatch.content}
              </code>
            );
            break;
          case 'italic':
            parts.push(<em key={keyIdx++} className="text-[#d0d0d0]">{firstMatch.content}</em>);
            break;
        }

        remaining = remaining.substring(firstMatch.end);
      }

      return parts.length === 1 ? parts[0] : <>{parts}</>;
    }

    lines.forEach((line, idx) => {
      // Code blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <div key={`code-end-${idx}`} className="my-1">
              <pre className="bg-[#1a1a2a] rounded-md p-3 text-[12px] font-mono text-[#a0a0b0] overflow-x-auto whitespace-pre-wrap">{/* end */}</pre>
            </div>
          );
          inCodeBlock = false;
        } else {
          flushList();
          flushTable();
          inCodeBlock = true;
          elements.push(
            <pre key={`code-${idx}`} className="bg-[#1a1a2a] rounded-md p-3 text-[12px] font-mono text-[#a0a0b0] overflow-x-auto my-2 whitespace-pre-wrap">
              <code>{line.trim().slice(3)}</code>
            </pre>
          );
        }
        return;
      }

      if (inCodeBlock) {
        // Append to last code element
        const lastEl = elements[elements.length - 1] as any;
        if (lastEl?.props?.children && Array.isArray(lastEl.props.children)) {
          lastEl.props.children.push(<span key={idx}>{line}\n</span>);
        }
        return;
      }

      // Tables
      if (line.includes('|') && line.trim().startsWith('|')) {
        flushList();
        const cells = line.split('|').filter((_, p, arr) => p > 0 && p < arr.length - 1);
        // Skip separator rows (---)
        if (cells.every(c => /^[\s\-:]+$/.test(c))) return;
        if (!inTable) inTable = true;
        tableRows.push(cells.map(c => c.trim()));
        return;
      } else if (inTable) {
        flushTable();
      }

      // Blockquote
      if (line.trim().startsWith('> ')) {
        flushList();
        const quote = line.trim().substring(2);
        elements.push(
          <blockquote key={`quote-${idx}`} className="border-l-2 border-purple-500/40 pl-3 my-2 text-[13px] text-[#a0a0b0] italic">
            {renderInline(quote)}
          </blockquote>
        );
        return;
      }

      // Headings
      if (line.startsWith('## ')) {
        flushList();
        flushTable();
        elements.push(
          <h3 key={`h3-${idx}`} className="text-base font-semibold text-white mt-4 mb-2">
            {renderInline(line.substring(3))}
          </h3>
        );
        return;
      }

      if (line.startsWith('### ')) {
        flushList();
        flushTable();
        elements.push(
          <h4 key={`h4-${idx}`} className="text-sm font-semibold text-[#d0d0e0] mt-3 mb-1">
            {renderInline(line.substring(4))}
          </h4>
        );
        return;
      }

      // Unordered list
      const ulMatch = line.match(/^(\s*)[-*]\s+(.+)/);
      if (ulMatch) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listBuffer.push(ulMatch[2]);
        return;
      }

      // Ordered list
      const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
      if (olMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listBuffer.push(olMatch[2]);
        return;
      }

      // Flush any open lists/tables
      flushList();
      flushTable();

      // Empty line
      if (line.trim() === '') {
        elements.push(<div key={`empty-${idx}`} className="h-2" />);
        return;
      }

      // Regular paragraph
      elements.push(
        <p key={`p-${idx}`} className="text-[13px] text-[#c0c0c0] leading-relaxed my-1">
          {renderInline(line)}
        </p>
      );
    });

    flushList();
    flushTable();

    return elements;
  }, []);

  // Render related article links
  const renderRelatedArticles = useCallback((relatedIds?: string[]) => {
    if (!relatedIds || relatedIds.length === 0) return null;
    const related = relatedIds
      .map(id => ({ id, article: getArticleById(id) }))
      .filter(r => r.article !== undefined);

    if (related.length === 0) return null;

    return (
      <div className="mt-6 pt-4 border-t border-[#3a3a4a]">
        <h4 className="text-xs font-semibold text-[#808090] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <LinkIcon size={12} />
          Related Articles
        </h4>
        <div className="space-y-1">
          {related.map(({ id, article }) => (
            <button
              key={id}
              onClick={() => article && selectArticle(id)}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md hover:bg-[#2a2a3a] transition-colors group"
            >
              <FileText size={14} className="text-[#606070] group-hover:text-purple-400 transition-colors flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[13px] text-[#a0a0b0] group-hover:text-white transition-colors truncate">
                  {article?.title}
                </div>
                <div className="text-[11px] text-[#606070] truncate">
                  {article?.description}
                </div>
              </div>
              <ChevronRight size={14} className="text-[#404050] group-hover:text-purple-400 transition-colors ml-auto flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }, [selectArticle]);

  // Render shortcut badges
  const renderShortcuts = useCallback((shortcuts?: Array<{ keys: string; description: string }>) => {
    if (!shortcuts || shortcuts.length === 0) return null;
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {shortcuts.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#2a2a3a] border border-[#3a3a4a]"
            title={s.description}
          >
            <Keyboard size={12} className="text-[#606070] flex-shrink-0" />
            <kbd className="text-[11px] text-purple-300 font-mono">{formatShortcut(s.keys)}</kbd>
            <span className="text-[10px] text-[#606070]">—</span>
            <span className="text-[11px] text-[#a0a0b0]">{s.description}</span>
          </div>
        ))}
      </div>
    );
  }, []);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#3a3a4a] flex-shrink-0">
        <div className="flex items-center gap-3">
          {viewMode === 'article' && (
            <button
              onClick={goBack}
              className="p-1 rounded hover:bg-[#2a2a3a] transition-colors text-[#808090] hover:text-white"
              title="Back to all articles"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 className="text-sm font-semibold text-white">
            {viewMode === 'article' && breadcrumb ? `${breadcrumb.category}` : 'Help'}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {viewMode !== 'search' && (
            <button
              onClick={goToFileSearch}
              className="p-1.5 rounded hover:bg-[#2a2a3a] transition-colors text-[#808090] hover:text-white"
              title="Search help"
            >
              <Search size={14} />
            </button>
          )}
          {viewMode === 'search' && (
            <button
              onClick={() => { setViewMode('browse'); setSearchQuery(''); }}
              className="p-1.5 rounded hover:bg-[#2a2a3a] transition-colors text-[#808090] hover:text-white"
              title="Back to browse"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#2a2a3a] transition-colors text-[#808090] hover:text-white"
            title="Close Help"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Search Bar (browse mode) */}
      {viewMode === 'browse' && (
        <div className="px-4 py-2.5 border-b border-[#2a2a3a] flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606070]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) {
                  setViewMode('search');
                } else {
                  setViewMode('browse');
                }
              }}
              placeholder="Search help articles..."
              className="w-full pl-9 pr-3 py-2 rounded-md bg-[#2a2a3a] text-sm text-[#e0e0e0] placeholder-[#505060] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]/50"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setViewMode('browse');
                }
              }}
              autoFocus={viewMode !== 'browse' || searchQuery.trim().length > 0}
            />
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* BROWSE MODE */}
        {viewMode === 'browse' && !searchQuery.trim() && (
          <div className="p-2">
            {/* Welcome Card */}
            <div className="mx-2 mt-2 mb-3 p-4 rounded-lg bg-gradient-to-br from-purple-900/20 to-indigo-900/10 border border-purple-500/20">
              <h3 className="text-sm font-semibold text-white mb-1">Welcome to WORBI Help</h3>
              <p className="text-[12px] text-[#a0a0b0] mb-3">
                Browse articles by category below, or use the search icon to find specific topics.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['welcome', 'first-document', 'workspace-layout', 'all-shortcuts'].map(id => {
                  const art = getArticleById(id);
                  if (!art) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => selectArticle(id)}
                      className="px-2.5 py-1 rounded-full bg-[#2a2a3a] hover:bg-[#3a3a4a] text-[11px] text-[#a0a0b0] hover:text-white transition-colors border border-[#3a3a4a]"
                    >
                      {art.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Categories */}
            {HELP_CATEGORIES.map(category => {
              const isExpanded = expandedCategories.has(category.id);
              return (
                <div key={category.id} className="mb-1">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md hover:bg-[#2a2a3a] transition-colors text-left"
                  >
                    {isExpanded ? <ChevronDown size={14} className="text-[#606070] flex-shrink-0" /> : <ChevronRight size={14} className="text-[#606070] flex-shrink-0" />}
                    <span className="text-lg flex-shrink-0">{category.icon}</span>
                    <span className="text-[13px] font-medium text-[#c0c0d0]">{category.name}</span>
                    <span className="text-[11px] text-[#505060] ml-auto">{category.articles.length}</span>
                  </button>

                  {isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {category.articles.map(article => (
                        <button
                          key={article.id}
                          onClick={() => selectArticle(article.id)}
                          className="flex items-start gap-2 w-full text-left px-3 py-2 rounded-md hover:bg-[#2a2a3a] transition-colors group"
                        >
                          <FileText size={14} className="text-[#505060] group-hover:text-purple-400 transition-colors flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-[13px] text-[#b0b0c0] group-hover:text-white transition-colors">
                              {article.title}
                            </div>
                            <div className="text-[11px] text-[#505060] line-clamp-2 mt-0.5">
                              {article.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* SEARCH MODE */}
        {searchQuery.trim() && viewMode !== 'article' && (
          <div className="p-2">
            <div className="px-3 py-2 text-xs text-[#606070]">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
            </div>

              {searchResults.length === 0 && searchQuery.trim() && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Search size={32} className="text-[#404050] mb-3" />
                <p className="text-sm text-[#606070]">No articles found</p>
                <p className="text-[12px] text-[#505060] mt-1">Try different keywords</p>
              </div>
            )}

            {searchResults.map(article => {
              const cat = getCategoryForArticle(article.id);
              return (
                <button
                  key={article.id}
                  onClick={() => selectArticle(article.id)}
                  className="flex items-start gap-3 w-full text-left px-3 py-3 rounded-md hover:bg-[#2a2a3a] transition-colors group"
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{cat?.icon || '📄'}</span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#b0b0c0] group-hover:text-white transition-colors">
                      {article.title}
                    </div>
                    <div className="text-[11px] text-[#606070] mt-0.5">
                      {cat?.name}
                    </div>
                    <div className="text-[12px] text-[#808090] mt-1 line-clamp-2">
                      {article.description}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#404050] group-hover:text-purple-400 transition-colors ml-auto flex-shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        )}

        {/* ARTICLE MODE */}
        {viewMode === 'article' && selectedArticle && (
          <div className="p-4 max-w-2xl">
            {/* Breadcrumb */}
            {breadcrumb && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#606070] mb-3">
                <button
                  onClick={goBack}
                  className="hover:text-purple-400 transition-colors"
                >
                  All Articles
                </button>
                <ChevronRight size={10} />
                <span className="text-[#a0a0b0]">{breadcrumb.category}</span>
              </div>
            )}

            {/* Article Header */}
            <h2 className="text-xl font-semibold text-white mb-1">{selectedArticle.title}</h2>
            <p className="text-[13px] text-[#808090] mb-4">{selectedArticle.description}</p>

            {/* Shortcuts */}
            {renderShortcuts(selectedArticle.shortcuts)}

            {/* Article Content */}
            <div className="mt-4">
              {renderContent(selectedArticle.content)}
            </div>

            {/* Related Articles */}
            {renderRelatedArticles(selectedArticle.relatedArticles)}

            {/* Back Link */}
            <div className="mt-6 pt-4 border-t border-[#2a2a3a]">
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 text-[12px] text-[#606070] hover:text-purple-400 transition-colors"
              >
                <ArrowLeft size={12} />
                Browse all articles
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#2a2a3a] flex-shrink-0">
        <div className="flex items-center justify-between text-[10px] text-[#505060]">
          <span>Press <kbd className="px-1 py-0.5 bg-[#2a2a3a] rounded text-[#808090] font-mono">Esc</kbd> to {viewMode === 'article' ? 'go back' : 'close'}</span>
          <span>{HELP_CATEGORIES.reduce((sum, c) => sum + c.articles.length, 0)} articles</span>
        </div>
      </div>
    </div>
  );
}