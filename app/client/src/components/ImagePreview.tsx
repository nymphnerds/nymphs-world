import { X, Download } from 'lucide-react';

interface ImagePreviewProps {
  src: string;
  name: string;
  onClose: () => void;
}

export function ImagePreview({ src, name, onClose }: ImagePreviewProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = name;
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1 rounded bg-black/50 text-white hover:bg-black/70"
          title="Close"
        >
          <X size={20} />
        </button>
        <button
          onClick={handleDownload}
          className="absolute top-2 left-2 z-10 p-1 rounded bg-black/50 text-white hover:bg-black/70"
          title="Download"
        >
          <Download size={20} />
        </button>
        <img
          src={src}
          alt={name}
          className="max-w-full max-h-[85vh] rounded shadow-lg object-contain"
        />
        <div className="mt-2 text-center text-sm text-white truncate">
          {name}
        </div>
      </div>
    </div>
  );
}