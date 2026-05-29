import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ActivityType } from '../navigation/useActivityRouter';
import { useAuthContext } from '../auth/AuthProvider';

type HideableIcon = ActivityType | 'ai';

const MIN_LEFT_WIDTH = 180;
const MAX_LEFT_WIDTH = 500;
const DEFAULT_LEFT_WIDTH = 250;
const LEFT_WIDTH_KEY = 'left-width-v2';
const MIN_RIGHT_WIDTH = 280;
const MAX_RIGHT_WIDTH = 600;
const MIN_SEARCH_WIDTH = 200;
const MAX_SEARCH_WIDTH = 500;

function readWidth(key: string, fallback: number, min: number, max: number) {
  const stored = localStorage.getItem(key);
  const parsed = stored ? parseInt(stored, 10) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function useLayout() {
  const { user } = useAuthContext();
  const prefix = user ? `wbu_${user.username}_` : 'wbu_';
  const [leftWidth, setLeftWidth] = useState(() => {
    return readWidth(`${prefix}${LEFT_WIDTH_KEY}`, DEFAULT_LEFT_WIDTH, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH);
  });
  const [rightWidth, setRightWidth] = useState(() => {
    return readWidth(`${prefix}right-width`, 350, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH);
  });
  const [leftPanelHidden, setLeftPanelHidden] = useState(() => {
    const stored = localStorage.getItem(`${prefix}left-panel-hidden`);
    return stored !== null ? stored === 'true' : false;
  });
  const [searchWidth, setSearchWidth] = useState(() => {
    return readWidth(`${prefix}search-width`, 250, MIN_SEARCH_WIDTH, MAX_SEARCH_WIDTH);
  });
  const [showAISidebar, setShowAISidebarState] = useState(() => {
    const stored = localStorage.getItem(`${prefix}ai-sidebar`);
    return stored !== null ? stored === 'true' : false;
  });

  const setShowAISidebar = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setShowAISidebarState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      localStorage.setItem(`${prefix}ai-sidebar`, String(next));
      return next;
    });
  }, [prefix]);

  const toggleAISidebar = useCallback(() => {
    setShowAISidebar((prev: boolean) => {
      const next = !prev;
      localStorage.setItem(`${prefix}ai-sidebar`, String(next));
      return next;
    });
  }, [prefix, setShowAISidebar]);

  const toggleLeftPanel = useCallback(() => {
    setLeftPanelHidden((prev) => {
      localStorage.setItem(`${prefix}left-panel-hidden`, String(!prev));
      return !prev;
    });
  }, [prefix]);

  useEffect(() => {
    setLeftWidth(readWidth(`${prefix}${LEFT_WIDTH_KEY}`, DEFAULT_LEFT_WIDTH, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH));
    setRightWidth(readWidth(`${prefix}right-width`, 350, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH));
    setSearchWidth(readWidth(`${prefix}search-width`, 250, MIN_SEARCH_WIDTH, MAX_SEARCH_WIDTH));
  }, [prefix]);

  /**
   * Create a horizontal resize handler.
   * @param setter - React state setter for the width value
   * @param getInitialWidth - Function returning the current width from React state
   * @param min - Minimum allowed width in px
   * @param max - Maximum allowed width in px
   * @param persistKey - localStorage key for persisting final width (null to skip)
   * @param reverse - If true, positive delta subtracts (for right-edge panels)
   */
  const createResizeHandler = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<number>>,
      getInitialWidth: () => number,
      min: number,
      max: number,
      persistKey: string | null,
      reverse: boolean = false,
    ) => {
      return (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = getInitialWidth();

        const onMouseMove = (moveEvent: MouseEvent) => {
          const delta = moveEvent.clientX - startX;
          const signedDelta = reverse ? -delta : delta;
          let newWidth = Math.round(startWidth + signedDelta);
          if (newWidth < min) newWidth = min;
          if (newWidth > max) newWidth = max;
          setter(newWidth);
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          if (persistKey) {
            // Read the final value from localStorage-compatible source
            // We persist via the setter's functional update pattern
            setter((current) => {
              localStorage.setItem(persistKey, String(current));
              return current;
            });
          }
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };
    },
    [],
  );

  const resizeLeftPanel = useCallback(
    (e: React.MouseEvent) => {
      createResizeHandler(
        setLeftWidth,
        () => leftWidth,
        MIN_LEFT_WIDTH,
        MAX_LEFT_WIDTH,
        `${prefix}${LEFT_WIDTH_KEY}`,
        false,
      )(e);
    },
    [createResizeHandler, leftWidth, prefix],
  );

  const resizeRightPanel = useCallback(
    (e: React.MouseEvent) => {
      createResizeHandler(
        setRightWidth,
        () => rightWidth,
        MIN_RIGHT_WIDTH,
        MAX_RIGHT_WIDTH,
        `${prefix}right-width`,
        true,
      )(e);
    },
    [createResizeHandler, rightWidth, prefix],
  );

  const resizeSearchPanel = useCallback(
    (e: React.MouseEvent) => {
      createResizeHandler(
        setSearchWidth,
        () => searchWidth,
        MIN_SEARCH_WIDTH,
        MAX_SEARCH_WIDTH,
        `${prefix}search-width`,
        false,
      )(e);
    },
    [createResizeHandler, searchWidth, prefix],
  );

  // Sidebar icon visibility — reactive to localStorage changes
  const [visibilityRefreshKey, setVisibilityRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setVisibilityRefreshKey(k => k + 1);
    window.addEventListener('storage', handler);
    window.addEventListener('wbu-sidebar-visibility-change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('wbu-sidebar-visibility-change', handler);
    };
  }, []);

  const hiddenIcons = useMemo((): Set<HideableIcon> => {
    void visibilityRefreshKey; // trigger recompute
    // If no user, default to all hidden — do NOT fall back to global wbu_ key
    if (!user?.username) return new Set<HideableIcon>(['tags', 'locations', 'timeline', 'outline', 'graph', 'images', 'reminders', 'ai']);
    try {
      const raw = localStorage.getItem(`wbu_${user.username}_sidebar_visibility`);
      if (raw) {
        const visibility: Record<string, boolean> = JSON.parse(raw);
        const hidden: HideableIcon[] = [];
        for (const key of Object.keys(visibility)) {
          if (visibility[key] === false) hidden.push(key as HideableIcon);
        }
        return new Set(hidden);
      }
    } catch { /* ignore */ }
    return new Set<HideableIcon>(['tags', 'locations', 'timeline', 'outline', 'graph', 'images', 'reminders', 'ai']);
  }, [visibilityRefreshKey, user?.username]);

  return {
    leftWidth,
    setLeftWidth,
    rightWidth,
    setRightWidth,
    searchWidth,
    setSearchWidth,
    leftPanelHidden,
    setLeftPanelHidden,
    showAISidebar,
    setShowAISidebar,
    toggleAISidebar,
    toggleLeftPanel,
    resizeLeftPanel,
    resizeRightPanel,
    resizeSearchPanel,
    hiddenIcons,
    visibilityRefreshKey,
  };
}

export type { HideableIcon };
