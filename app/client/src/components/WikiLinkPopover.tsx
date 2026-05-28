import { useEffect, useState, useRef, useCallback } from 'react';
import { resolveWikiLink } from '../services/api';
import type { WikiLinkResolveResult } from '../services/api';

interface WikiLinkPopoverProps {
  targetName: string;
  anchorRect: DOMRect;
  onOpen?: (filePath: string) => void;
  onCreate?: (name: string) => void;
  onClose?: () => void;
}

export function WikiLinkPopover({ targetName, anchorRect, onOpen, onCreate, onClose }: WikiLinkPopoverProps) {
  const [result, setResult] = useState<WikiLinkResolveResult | null>(null);
  const [loading, setLoading] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start the auto-close timer
  const startCloseTimer = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      onClose?.();
    }, 1500);
  }, [onClose]);

  // Cancel the auto-close timer
  const cancelCloseTimer = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  // Auto-close timer: only starts after data loads (so API has time to resolve)
  useEffect(() => {
    if (!loading) {
      startCloseTimer();
    }
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [loading, startCloseTimer]);

  // Fetch wiki link data
  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      try {
        const data = await resolveWikiLink(targetName);
        if (!cancelled) {
          setResult(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [targetName]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Position: below the anchor, with viewport clamping
  const position = useCallback(() => {
    const gap = 8;
    let top = anchorRect.bottom + gap;
    let left = anchorRect.left;

    // Estimate popover width (will adjust after render)
    const estimatedWidth = 300;
    const viewportWidth = window.innerWidth;

    if (left + estimatedWidth > viewportWidth - 16) {
      left = viewportWidth - estimatedWidth - 16;
    }
    if (left < 8) left = 8;

    return { top, left };
  }, [anchorRect]);

  const pos = position();

  const handleOpen = () => {
    if (result?.exists && result.filePath) {
      onOpen?.(result.filePath);
      onClose?.();
    }
  };

  const handleCreate = () => {
    onCreate?.(targetName);
    onClose?.();
  };

  return (
    <div
      ref={popoverRef}
      data-wiki-link-popover
      className="wiki-link-popover"
      style={{
        position: 'fixed',
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        zIndex: 10000,
      }}
      onMouseEnter={cancelCloseTimer}
      onMouseLeave={startCloseTimer}
    >
      {loading ? (
        <div className="text-[11px] text-muted-foreground/60 py-2">Resolving...</div>
      ) : result?.exists ? (
        <>
          <div className="font-semibold text-[13px] text-foreground mb-0.5">
            {targetName}
          </div>
          <div className="text-[11px] text-muted-foreground/60 mb-2 truncate">
            {result.filePath}
          </div>
          {result.contentPreview && (
            <div className="text-[11px] text-muted-foreground/70 mb-3 line-clamp-3 leading-relaxed">
              {result.contentPreview}
            </div>
          )}
          <button
            onClick={handleOpen}
            className="wiki-link-popover-btn"
          >
            Open Document
          </button>
        </>
      ) : (
        <>
          <div className="font-semibold text-[13px] text-foreground mb-0.5">
            {targetName}
          </div>
          <div className="text-[11px] text-amber-400/70 mb-3">
            Document not yet created
          </div>
          <button
            onClick={handleCreate}
            className="wiki-link-popover-btn wiki-link-popover-btn-create"
          >
            Create Document
          </button>
        </>
      )}
    </div>
  );
}