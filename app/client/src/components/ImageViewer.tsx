import { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Minus } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  name: string;
  onClose: () => void;
}

export function ImageViewer({ src, name, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom and position when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale(prev => Math.max(0.1, Math.min(10, prev + delta)));
  }, []);

  // Pan with mouse drag (only when zoomed in)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom buttons
  const zoomIn = () => setScale(prev => Math.min(10, prev + 0.3));
  const zoomOut = () => setScale(prev => Math.max(0.1, prev - 0.3));
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {/* Controls bar */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-50 bg-black/60 rounded-lg px-3 py-2 backdrop-blur-sm">
        <button
          onClick={zoomOut}
          className="p-1.5 rounded-md hover:bg-white/20 text-white transition-colors"
          title="Zoom out (scroll down)"
        >
          <ZoomOut size={18} />
        </button>
        <span className="text-white text-xs font-mono min-w-[3ch] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="p-1.5 rounded-md hover:bg-white/20 text-white transition-colors"
          title="Zoom in (scroll up)"
        >
          <ZoomIn size={18} />
        </button>
        <div className="w-px h-5 bg-white/30" />
        <button
          onClick={resetZoom}
          className="p-1.5 rounded-md hover:bg-white/20 text-white transition-colors"
          title="Reset zoom"
        >
          <Minus size={18} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-white/20 text-white transition-colors"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="relative cursor-grab active:cursor-grabbing select-none"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: '90vw',
          height: '85vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <img
          src={src}
          alt={name}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* File name */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/60 rounded-lg px-4 py-2 backdrop-blur-sm">
        <span className="text-white text-sm truncate max-w-md">{name}</span>
      </div>
    </div>
  );
}