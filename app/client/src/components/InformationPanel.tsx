import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFileTags, useTags } from '../hooks/useTags';
import { useFileLocations, useLocations } from '../hooks/useLocations';
import { useScenes, useFileScenes } from '../hooks/useScenes';
import { saveTimelineMetadata, suggestTimelineDate, type TimelineMetadata as ApiTimelineMetadata, getBacklinks, type WikiLinkBacklink } from '../services/api';
import { X, Camera, Link, Plus, Image as ImageIcon, StickyNote, Trash2, Clock, MapPin, Film } from 'lucide-react';
import { HeroImagePicker } from './HeroImagePicker';
import { ImageExplorer } from './ImageExplorer';
import { ImageViewer } from './ImageViewer';
import { MiniGraphPreview } from './MiniGraphPreview';
import { signImageFromWorkspace } from '../services/api';
import { getEras } from '../utils/timelineConfig';

const HERO_STORAGE_KEY = 'wbu_hero_images';
const GALLERY_STORAGE_KEY = 'wbu_file_images';
const NOTES_STORAGE_KEY = 'wbu_file_notes';
const PANEL_LAYOUT_KEY = 'wbu_panel_layout';
const TIMELINE_STORAGE_KEY = 'wbu_file_timeline';

// --- Timeline metadata ---

interface TimelineMetadata {
  date: string;
  era: string;
}

function getTimelineMetadata(): Record<string, TimelineMetadata> {
  try {
    const raw = localStorage.getItem(TIMELINE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setTimelineMetadata(filePath: string, metadata: Partial<TimelineMetadata>) {
  const all = getTimelineMetadata();
  const existing = all[filePath] || { date: '', era: '' };
  all[filePath] = { ...existing, ...metadata };
  localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(all));
}

function removeTimelineMetadata(filePath: string, field: keyof TimelineMetadata) {
  const all = getTimelineMetadata();
  const existing = all[filePath];
  if (existing) {
    delete existing[field];
    if (Object.keys(existing).length === 0) {
      delete all[filePath];
    }
    localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(all));
  }
}

// Era and category lists are now managed via Timeline Settings modal
// and stored in localStorage. These are reactivity read from shared config.
// (No static defaults here — see timelineConfig.ts for DEFAULT_ERAS / DEFAULT_CATEGORIES)

// --- Hero images (single per file) ---

function getHeroImages(): Record<string, string> {
  try {
    const raw = localStorage.getItem(HERO_STORAGE_KEY);
    const images: Record<string, string> = raw ? JSON.parse(raw) : {};
    // Migrate old entries: old format stored full API URLs like "/api/files/workspace/..."
    // New format stores just the workspace file path like "images/photo.png"
    let migrated = false;
    const migratedImages: Record<string, string> = {};
    for (const [key, value] of Object.entries(images)) {
      const strValue = String(value);
      if (strValue.startsWith('/api/files/workspace/')) {
        // Extract the file path from the URL by decoding path segments
        const urlPath = strValue.replace('/api/files/workspace/', '');
        const filePath = urlPath.split('/').map((s: string) => decodeURIComponent(s)).join('/');
        migratedImages[key] = filePath;
        migrated = true;
      } else {
        migratedImages[key] = strValue;
      }
    }
    if (migrated) {
      localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(migratedImages));
      return migratedImages;
    }
    return images;
  } catch {
    return {};
  }
}

function setHeroImage(filePath: string, imageFilePath: string) {
  const images = getHeroImages();
  images[filePath] = imageFilePath;
  localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(images));
}

function removeHeroImage(filePath: string) {
  const images = getHeroImages();
  delete images[filePath];
  localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(images));
}

// --- Gallery images (array per file) ---

interface GalleryImage {
  id: string;
  path: string;
  name: string;
}

function getGalleryImages(): Record<string, GalleryImage[]> {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setGalleryImages(filePath: string, images: GalleryImage[]) {
  const all = getGalleryImages();
  all[filePath] = images;
  localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(all));
}

function addGalleryImage(filePath: string, image: GalleryImage) {
  const all = getGalleryImages();
  const existing = all[filePath] || [];
  // Avoid duplicates by path
  if (!existing.some(img => img.path === image.path)) {
    all[filePath] = [...existing, image];
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(all));
  }
}

function removeGalleryImage(filePath: string, imageId: string) {
  const all = getGalleryImages();
  const existing = all[filePath] || [];
  all[filePath] = existing.filter(img => img.id !== imageId);
  localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(all));
}

// --- Notes (array per file) ---

interface Note {
  id: string;
  title: string;
  content: string;
}

function getNotes(): Record<string, Note[]> {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setNotes(filePath: string, notes: Note[]) {
  const all = getNotes();
  all[filePath] = notes;
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(all));
}

function addNote(filePath: string) {
  const all = getNotes();
  const existing = all[filePath] || [];
  const newNote: Note = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    content: '',
  };
  all[filePath] = [...existing, newNote];
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(all));
}

function updateNote(filePath: string, noteId: string, updates: Partial<Pick<Note, 'title' | 'content'>>) {
  const all = getNotes();
  const existing = all[filePath] || [];
  all[filePath] = existing.map(n => n.id === noteId ? { ...n, ...updates } : n);
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(all));
}

function removeNote(filePath: string, noteId: string) {
  const all = getNotes();
  const existing = all[filePath] || [];
  all[filePath] = existing.filter(n => n.id !== noteId);
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(all));
}

// --- Component ---

type TabType = 'images' | 'notes';

interface InformationPanelProps {
  currentPath: string | null;
  onTimelineMetadataChange?: (filePath: string, metadata: TimelineMetadata) => void;
  onOpenGraph?: () => void;
  onOpenTagSidebar?: () => void;
  username?: string | null;
}

export function InformationPanel({ currentPath, onTimelineMetadataChange, onOpenGraph, onOpenTagSidebar, username }: InformationPanelProps) {
  const { fileTags, removeTag, addTags, loading, refresh: refreshFileTags } = useFileTags(currentPath);
  const { tags } = useTags();

  // --- Tag select handler (moved from toolbar TagInsertControl) ---
  const handleSelectTagForFile = async (tagName: string) => {
    if (!tagName || !currentPath) return;
    await addTags([tagName]);
    window.dispatchEvent(new CustomEvent('wbu-tags-changed', { detail: { filePath: currentPath } }));
  };
  const { fileLocations, addLocations, removeLocation, loading: locationsLoading } = useFileLocations(currentPath);
  const { locations } = useLocations();
  // --- Scenes ---
  const { scenes, deleteScene } = useScenes();
  const { fileScenes, addScenes, removeScene } = useFileScenes(currentPath);
  const [showSceneDropdown, setShowSceneDropdown] = useState(false);
  const sceneDropdownRef = useRef<HTMLDivElement>(null);
  const sceneButtonRef = useRef<HTMLButtonElement>(null);
  const scenePortalRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Calculate dropdown position based on button rect (for portal rendering)
  useEffect(() => {
    if (showSceneDropdown && sceneButtonRef.current) {
      const rect = sceneButtonRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 4, left: rect.left });
    }
  }, [showSceneDropdown]);

  // Close scene dropdown on outside click (check both container ref and portal ref)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideContainer = sceneDropdownRef.current?.contains(target);
      const insidePortal = scenePortalRef.current?.contains(target);
      if (!insideContainer && !insidePortal) {
        setShowSceneDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scenes not yet assigned to this file
  const unassignedScenes = scenes.filter(s => !fileScenes.some(fs => fs.id === s.id));

  const getLocationColor = (locName: string) => {
    return locations.find(l => l.name === locName)?.color || '#10b981';
  };

  // --- Backlinks ---
  const [backlinks, setBacklinks] = useState<WikiLinkBacklink[]>([]);
  const [backlinksLoading, setBacklinksLoading] = useState(false);

  useEffect(() => {
    if (!currentPath) {
      setBacklinks([]);
      return;
    }
    setBacklinksLoading(true);
    getBacklinks(currentPath)
      .then((data) => setBacklinks(data))
      .catch(() => setBacklinks([]))
      .finally(() => setBacklinksLoading(false));
  }, [currentPath]);

  // --- Timeline metadata state ---
  const [timelineMeta, setTimelineMeta] = useState<TimelineMetadata>({ date: '', era: '' });
  const [eraOptions, setEraOptions] = useState<string[]>(() => getEras());

  // Refresh era list from localStorage when settings change
  useEffect(() => {
    const handler = () => {
      setEraOptions(getEras());
    };
    window.addEventListener('storage', handler);
    // Also poll for changes from same-tab (localStorage doesn't fire 'storage' in same tab)
    const interval = setInterval(() => {
      setEraOptions(getEras());
    }, 1000);
    return () => {
      window.removeEventListener('storage', handler);
      clearInterval(interval);
    };
  }, []);

  // Load timeline metadata when file changes
  useEffect(() => {
    if (currentPath) {
      const all = getTimelineMetadata();
      setTimelineMeta(all[currentPath] || { date: '', era: '' });
    } else {
      setTimelineMeta({ date: '', era: '' });
    }
  }, [currentPath]);

  const updateTimelineField = useCallback(async (field: keyof TimelineMetadata, value: string) => {
    if (!currentPath) return;
    const updated = { ...timelineMeta, [field]: value };
    setTimelineMeta(updated);
    setTimelineMetadata(currentPath, { [field]: value });
    onTimelineMetadataChange?.(currentPath, updated);
    // Also persist to server so Timeline View can pick it up
    try {
      await saveTimelineMetadata(currentPath, { [field]: value } as Partial<ApiTimelineMetadata>);
    } catch {
      // Server save failed — client-side localStorage still saved
    }
  }, [currentPath, timelineMeta, onTimelineMetadataChange]);

  const clearTimelineField = useCallback(async (field: keyof TimelineMetadata) => {
    if (!currentPath) return;
    removeTimelineMetadata(currentPath, field);
    setTimelineMeta(prev => ({ ...prev, [field]: '' }));
    onTimelineMetadataChange?.(currentPath, { ...timelineMeta, [field]: '' });
    // Also clear on server
    try {
      await saveTimelineMetadata(currentPath, { [field]: '' } as Partial<ApiTimelineMetadata>);
    } catch {
      // Server save failed
    }
  }, [currentPath, timelineMeta, onTimelineMetadataChange]);

  // Listen for tag changes from other components (e.g., TagInsertControl toolbar)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.filePath === currentPath) {
        refreshFileTags();
      }
    };
    window.addEventListener('wbu-tags-changed', handler);
    return () => window.removeEventListener('wbu-tags-changed', handler);
  }, [currentPath, refreshFileTags]);

  // Hero image state
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [showExplorer, setShowExplorer] = useState(false);
  const [viewerImage, setViewerImage] = useState<{ src: string; name: string } | null>(null);
  // Proxy URLs for thumbnails (image path → proxy URL)
  const galleryProxyUrls = useRef<Map<string, string>>(new Map());

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);

  // Active tab
  const [activeTab, setActiveTab] = useState<TabType>('images');

  // Individual section heights within the panel (persisted in localStorage)
  const loadLayout = () => {
    try {
      const raw = localStorage.getItem(PANEL_LAYOUT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const savedLayout = loadLayout();

  const [heroHeight, setHeroHeight] = useState(savedLayout?.heroHeight ?? 160);
  const [tagsHeight, setTagsHeight] = useState(savedLayout?.tagsHeight ?? 70);
  const [timelineHeight, setTimelineHeight] = useState(savedLayout?.timelineHeight ?? 150);
  const [imagesNotesHeight, setImagesNotesHeight] = useState(savedLayout?.imagesNotesHeight ?? 200);
  const [relationshipsHeight, setRelationshipsHeight] = useState(savedLayout?.relationshipsHeight ?? 140);

  // Persist layout to localStorage whenever any height changes
  useEffect(() => {
    const layout = { heroHeight, tagsHeight, timelineHeight, imagesNotesHeight, relationshipsHeight };
    localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(layout));
  }, [heroHeight, tagsHeight, timelineHeight, imagesNotesHeight, relationshipsHeight]);

  // Load hero image proxy URL from localStorage when file changes
  useEffect(() => {
    if (currentPath) {
      const images = getHeroImages();
      const imageFilePath = images[currentPath];
      if (imageFilePath) {
        signImageFromWorkspace(imageFilePath)
          .then(url => setHeroUrl(url))
          .catch(() => setHeroUrl(null));
      } else {
        setHeroUrl(null);
      }
    } else {
      setHeroUrl(null);
    }
  }, [currentPath]);

  // Load gallery images and sign proxy URLs for thumbnails when file changes
  useEffect(() => {
    galleryProxyUrls.current.clear();

    if (currentPath) {
      const all = getGalleryImages();
      const images = all[currentPath] || [];
      setGalleryImages(images);

      // Sign proxy URLs for each thumbnail
      images.forEach(image => {
        signImageFromWorkspace(image.path)
          .then(url => {
            galleryProxyUrls.current.set(image.path, url);
            setGalleryImages(prev => [...prev]);
          })
          .catch(() => {
            // Proxy URL not available, thumbnail will show placeholder
          });
      });
    } else {
      setGalleryImages([]);
    }
  }, [currentPath]);

  // Load notes when file changes
  useEffect(() => {
    if (currentPath) {
      const all = getNotes();
      setNotes(all[currentPath] || []);
    } else {
      setNotes([]);
    }
  }, [currentPath]);

  // --- Hero handlers ---

  const handleSetHeroClick = () => {
    if (!currentPath) return;
    setShowPicker(true);
  };

  const handleImageSelected = (filePath: string) => {
    if (!currentPath) return;
    // Store the file path in localStorage (not a URL)
    setHeroImage(currentPath, filePath);
    // Sign proxy URL for immediate display
    signImageFromWorkspace(filePath)
      .then(url => setHeroUrl(url))
      .catch(() => setHeroUrl(null));
    setShowPicker(false);
  };

  const handleRemoveHero = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentPath) return;
    if (!window.confirm('Remove this image as the hero image for this document? The image file will not be deleted.')) return;
    removeHeroImage(currentPath);
    setHeroUrl(null);
  };

  // --- Gallery handlers ---

  const handleAddImage = (filePath: string) => {
    if (!currentPath) return;
    const name = filePath.split('/').pop() || filePath;
    const image: GalleryImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      path: filePath,
      name: name,
    };
    addGalleryImage(currentPath, image);
    setGalleryImages(prev => [...prev, image]);

    // Sign proxy URL for the new thumbnail
    signImageFromWorkspace(filePath)
      .then(url => {
        galleryProxyUrls.current.set(filePath, url);
        setGalleryImages(prev => [...prev]);
      })
      .catch(() => {});
  };

  const handleRemoveImage = (imageId: string) => {
    if (!currentPath) return;
    removeGalleryImage(currentPath, imageId);
    setGalleryImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleThumbnailClick = async (image: GalleryImage) => {
    // Use existing proxy URL or sign a new one
    const proxyUrl = galleryProxyUrls.current.get(image.path);
    if (proxyUrl) {
      setViewerImage({ src: proxyUrl, name: image.name });
    } else {
      try {
        const url = await signImageFromWorkspace(image.path);
        galleryProxyUrls.current.set(image.path, url);
        setViewerImage({ src: url, name: image.name });
      } catch {
        // Could not sign image
      }
    }
  };

  // --- Notes handlers ---

  const handleAddNote = () => {
    if (!currentPath) return;
    addNote(currentPath);
    const all = getNotes();
    setNotes(all[currentPath] || []);
  };

  const handleUpdateNote = (noteId: string, updates: Partial<Pick<Note, 'title' | 'content'>>) => {
    if (!currentPath) return;
    updateNote(currentPath, noteId, updates);
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...updates } : n));
  };

  const handleRemoveNote = (noteId: string) => {
    if (!currentPath) return;
    removeNote(currentPath, noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  // --- Helpers ---

  const getTagColor = (tagName: string) => {
    return tags.find(t => t.name === tagName)?.color || '#a78bfa';
  };

  function hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Draggable divider handler for vertical resizing
  // When reverse=true, the resized section is BELOW the divider (dragging down grows it)
  const createDividerHandler = (setter: React.Dispatch<React.SetStateAction<number>>, currentVal: number, min: number, maxPercent: number, reverse: boolean = false) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = e.currentTarget.parentElement as HTMLElement;
      if (!container) return;
      const startY = e.clientY;
      const startHeight = currentVal;

      const onMouseMove = (e: MouseEvent) => {
        const deltaY = e.clientY - startY;
        const containerHeight = container.getBoundingClientRect().height;
        // When reverse=true, the section being resized is below the divider,
        // so dragging down (positive deltaY) should increase its height
        const adjustedDelta = reverse ? -deltaY : deltaY;
        const newHeight = Math.max(min, Math.min(containerHeight * (maxPercent / 100), startHeight + adjustedDelta));
        setter(newHeight);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-card">
      {/* Section 1: File Hero Image (resizable) */}
      <div className="flex flex-col items-center justify-center px-3 py-2 border-b border-border/30 bg-secondary/20 overflow-auto" style={{ height: `${heroHeight}px`, minHeight: `${heroHeight}px` }}>
        {/* Filename heading */}
        {currentPath && (
          <div className="w-full text-center mb-2">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              {currentPath.replace('.html', '').split('/').pop()}
            </span>
          </div>
        )}
        <div
          className="w-full aspect-video rounded-md bg-card border border-border/50 flex items-center justify-center overflow-hidden relative cursor-pointer group"
          onClick={handleSetHeroClick}
          title={heroUrl ? 'Click to change hero image' : 'Click to set hero image'}
        >
          {heroUrl ? (
            <>
              <img
                src={heroUrl}
                alt="Hero"
                className="w-full h-full object-cover rounded-md"
                onError={() => setHeroUrl(null)}
              />
              <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={handleRemoveHero}
                  className="p-1 bg-black/60 rounded-full hover:bg-red-500/60 transition-colors"
                  title="Remove hero image"
                >
                  <X size={14} color="white" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Camera size={20} opacity={0.4} />
              <span className="text-[10px] opacity-50">Set Hero Image</span>
            </div>
          )}
        </div>
      </div>

      {/* Draggable divider between Hero and Tags */}
      <div
        className="info-divider h-1 cursor-ns-resize hover:bg-primary/30 transition-colors flex-shrink-0"
        onMouseDown={createDividerHandler(setHeroHeight, heroHeight, 60, 80)}
      />

      {/* Section 2: Active File Tags (resizable) */}
      <div className="px-3 py-2 border-b border-border/30 bg-secondary/10 overflow-auto" style={{ height: `${tagsHeight}px`, minHeight: `${tagsHeight}px` }}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Tags</span>
            {loading && <span className="text-[9px] text-muted-foreground/50 ml-1">loading...</span>}
          </div>
          {currentPath && (
            <div className="flex items-center gap-0.5">
              <select
                defaultValue=""
                onChange={(e) => handleSelectTagForFile(e.target.value)}
                className="h-5 px-1 text-[10px] rounded bg-background border border-border text-muted-foreground outline-none cursor-pointer"
                title="Select a tag to apply to document"
              >
                <option value="" disabled>Tag...</option>
                {tags.filter(tag => !fileTags.includes(tag.name)).map(tag => (
                  <option key={tag.id} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </select>
              {onOpenTagSidebar && (
                <button
                  onClick={() => onOpenTagSidebar()}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground transition-colors"
                  title="Create new tag"
                >
                  <Plus size={12} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {fileTags.length === 0 && !loading && (
            <span className="text-[10px] text-muted-foreground/40 italic">No tags assigned</span>
          )}
          {fileTags.map(tagName => {
            const color = getTagColor(tagName);
            const rgbaColor = hexToRgba(color, 0.45);
            return (
               <span
                 key={tagName}
                 className="tag-banner tag-banner-interactive"
                 style={{
                   color: color,
                   borderColor: color,
                   boxShadow: `0 0 8px 2px ${rgbaColor}`,
                } as React.CSSProperties}
               >
                {tagName}
                <button
                  onClick={() => removeTag(tagName)}
                  className="tag-remove-btn"
                  style={{ color: color } as React.CSSProperties}
                  title={`Remove ${tagName} from file`}
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {/* Draggable divider between Tags and Timeline */}
      <div
        className="info-divider h-1 cursor-ns-resize hover:bg-primary/30 transition-colors flex-shrink-0"
        onMouseDown={createDividerHandler(setTagsHeight, tagsHeight, 50, 80)}
      />

      {/* Section 3: Scenes (resizable) */}
      <div className="flex flex-col overflow-hidden" style={{ height: `${timelineHeight}px`, minHeight: `${timelineHeight}px` }}>
         {/* Scenes header - fixed at top */}
         <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-secondary/10 flex-shrink-0 self-start">
          <div className="flex items-center gap-1">
            <Film size={10} className="text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Scenes</span>
            {fileScenes.length > 0 && <span className="text-[9px] text-muted-foreground/40">({fileScenes.length})</span>}
          </div>
          <div ref={sceneDropdownRef} className="relative">
            <button
              ref={sceneButtonRef}
              onClick={() => setShowSceneDropdown(!showSceneDropdown)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] rounded bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
              disabled={unassignedScenes.length === 0}
            >
              <Plus size={9} /> Add
            </button>
            {showSceneDropdown && unassignedScenes.length > 0 && createPortal(
              <div
                ref={scenePortalRef}
                className="z-[9999] w-64 bg-popover border border-border rounded-md shadow-2xl py-1 max-h-80 overflow-y-auto"
                style={{ position: 'fixed', top: dropdownPosition.top, left: dropdownPosition.left }}
              >
                {unassignedScenes.map(scene => (
                  <button
                    key={scene.id}
                    className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-secondary transition-colors"
                    onClick={async () => {
                      try {
                        await addScenes([scene.id]);
                        setShowSceneDropdown(false);
                      } catch (err) {
                        console.error('[InfoPanel] Failed to add scene:', err);
                        alert(`Failed to add scene: ${err instanceof Error ? err.message : 'Unknown error'}`);
                      }
                    }}
                  >
                    <div className="font-medium text-foreground truncate">{scene.name}</div>
                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <Clock size={8} />{scene.era}{scene.date ? ` · ${scene.date}` : ''}
                      </span>
                      <span className="flex items-center gap-0.5" style={{ color: getLocationColor(scene.locationName) }}>
                        <MapPin size={8} />{scene.locationName}
                      </span>
                    </div>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
         </div>
         {/* Scene List - scrolls independently */}
         <div className="flex-1 overflow-y-auto px-3 py-2 bg-secondary/10 min-h-0">
        {fileScenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Film size={24} className="text-muted-foreground/20 mb-1" />
            <span className="text-[10px] text-muted-foreground/30 italic">No scenes yet</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {fileScenes.map(scene => {
              const locColor = getLocationColor(scene.locationName);
              return (
                <div
                  key={scene.id}
                  className="group rounded-md border border-border/40 bg-secondary/10 px-2 py-1.5 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-foreground truncate">{scene.name}</div>
                      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <Clock size={8} />{scene.era}{scene.date ? ` · ${scene.date}` : ''}
                        </span>
                        <span className="flex items-center gap-0.5" style={{ color: locColor }}>
                          <MapPin size={8} />{scene.locationName}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeScene(scene.id)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-muted-foreground/40 hover:text-red-400 transition-colors ml-1"
                      title={`Remove "${scene.name}" from this file`}
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
         </div>
      </div>

      {/* Draggable divider between Timeline and Images/Notes */}
      <div
        className="info-divider h-1 cursor-ns-resize hover:bg-primary/30 transition-colors flex-shrink-0"
        onMouseDown={createDividerHandler(setTimelineHeight, timelineHeight, 60, 80)}
      />

      <div className="flex flex-col overflow-hidden" style={{ height: `${imagesNotesHeight}px`, minHeight: `${imagesNotesHeight}px` }}>
        {/* Tab bar */}
        <div className="flex border-b border-border/40 bg-secondary/10">
          <button
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'images'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon size={12} />
            Images
            {galleryImages.length > 0 && (
              <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded-full">{galleryImages.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'notes'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <StickyNote size={12} />
            Notes
            {notes.length > 0 && (
              <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded-full">{notes.length}</span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {activeTab === 'images' && (
            <div>
              {galleryImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ImageIcon size={32} className="text-muted-foreground/30 mb-2" />
                  <p className="text-[11px] text-muted-foreground/50 mb-3">No additional images yet</p>
                  <button
                    onClick={() => setShowExplorer(true)}
                    disabled={!currentPath}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} />
                    Add Images
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-muted-foreground">{galleryImages.length} image{galleryImages.length !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => setShowExplorer(true)}
                      disabled={!currentPath}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus size={10} />
                      Add
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {galleryImages.map(image => {
                      const proxyUrl = galleryProxyUrls.current.get(image.path);
                      return (
                        <div
                          key={image.id}
                          className="group relative aspect-square rounded-md bg-card border border-border/40 overflow-hidden cursor-pointer"
                          onClick={() => handleThumbnailClick(image)}
                        >
                          {proxyUrl ? (
                            <img
                              src={proxyUrl}
                              alt={image.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon size={20} className="text-muted-foreground/20" />
                            </div>
                          )}
                          {/* Delete button - top-right corner */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveImage(image.id); }}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/60 transition-all"
                            title="Remove image"
                          >
                            <Trash2 size={11} color="white" />
                          </button>
                          {/* Name label */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-0.5">
                            <span className="text-[9px] text-white truncate block">{image.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <StickyNote size={32} className="text-muted-foreground/30 mb-2" />
                  <p className="text-[11px] text-muted-foreground/50 mb-3">No notes yet</p>
                  <button
                    onClick={handleAddNote}
                    disabled={!currentPath}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} />
                    Add Note
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-muted-foreground">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
                    <button
                      onClick={handleAddNote}
                      disabled={!currentPath}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus size={10} />
                      Add
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {notes.map(note => (
                      <div
                        key={note.id}
                        className="rounded-md border border-border/40 bg-secondary/10 overflow-hidden info-note-card"
                      >
                        {/* Note header with title input and remove button */}
                        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/20 bg-secondary/20">
                          <input
                            type="text"
                            value={note.title}
                            onChange={(e) => handleUpdateNote(note.id, { title: e.target.value })}
                            placeholder="Note title..."
                            className="flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                          />
                          <button
                            onClick={() => handleRemoveNote(note.id)}
                            className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground/40 hover:text-red-400 transition-colors"
                            title="Remove note"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        {/* Note content textarea */}
                        <textarea
                          value={note.content}
                          onChange={(e) => handleUpdateNote(note.id, { content: e.target.value })}
                          placeholder="Write your note here..."
                          rows={4}
                          className="w-full px-2 py-2 bg-transparent text-[11px] text-foreground outline-none resize-y placeholder:text-muted-foreground/30 min-h-[60px] focus:ring-1 focus:ring-primary/30 transition-shadow"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Draggable horizontal divider between Images/Notes and Relationships */}
      <div
        className="info-divider h-1 cursor-ns-resize hover:bg-primary/30 transition-colors flex-shrink-0"
        onMouseDown={createDividerHandler(setImagesNotesHeight, imagesNotesHeight, 60, 80)}
      />

      {/* Section 4: Relationships (resizable) */}
      <div className="bg-secondary/5 overflow-auto" style={{ height: `${relationshipsHeight}px`, minHeight: `${relationshipsHeight}px` }}>
        <div className="flex items-center gap-1 mb-1.5 px-3">
          <Link size={10} className="text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Relationships</span>
        </div>
        <MiniGraphPreview currentPath={currentPath} onOpenGraph={onOpenGraph || (() => {})} username={username} />
      </div>

      {/* Section 5: Backlinks */}
      <div className="px-3 py-2 bg-secondary/5 border-t border-border/30">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <Link size={10} className="text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Backlinks {backlinks.length > 0 ? `(${backlinks.length})` : ''}
            </span>
          </div>
          {backlinksLoading && (
            <span className="text-[9px] text-muted-foreground/40">Loading...</span>
          )}
        </div>
        {backlinks.length === 0 && !backlinksLoading ? (
          <div className="flex items-center justify-center py-2">
            <span className="text-[10px] text-muted-foreground/30 italic">No backlinks</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
            {backlinks.map((bl, idx) => (
              <div
                key={idx}
                className="rounded-md border border-border/30 bg-secondary/10 px-2 py-1.5 hover:bg-secondary/20 transition-colors cursor-pointer"
                title={bl.filePath}
              >
                <div className="text-[11px] text-foreground font-medium truncate">{bl.filePath.split('/').pop()}</div>
                {bl.snippet && (
                  <div className="text-[9px] text-muted-foreground/50 truncate mt-0.5">
                    {bl.snippet}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showPicker && (
        <HeroImagePicker
          onSelect={handleImageSelected}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showExplorer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowExplorer(false)}>
          <div className="bg-background rounded-lg shadow-xl w-[90vw] h-[80vh] max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <ImageExplorer
              onImageSelect={(url, path) => { handleAddImage(path); setShowExplorer(false); }}
              onClose={() => setShowExplorer(false)}
              onGenerate={() => setShowExplorer(false)}
            />
          </div>
        </div>
      )}


      {viewerImage && (
        <ImageViewer
          src={viewerImage.src}
          name={viewerImage.name}
          onClose={() => setViewerImage(null)}
        />
      )}
    </div>
  );
}
