import { Link, Image, FileText, FolderOpen, AlertTriangle, Copy } from 'lucide-react';

interface SummaryCardsProps {
  brokenLinks: number;
  orphanedImages: number;
  orphanedMeta: number;
  emptyDirs: number;
  corruptedHtml: number;
  duplicates: number;
}

const cardDefs = [
  { icon: Link, label: 'Broken Links', color: 'text-red-400' },
  { icon: Image, label: 'Orphaned Images', color: 'text-amber-400' },
  { icon: FileText, label: 'Orphaned Meta', color: 'text-amber-400' },
  { icon: FolderOpen, label: 'Empty Dirs', color: 'text-blue-400' },
  { icon: AlertTriangle, label: 'Corrupted HTML', color: 'text-red-400' },
  { icon: Copy, label: 'Duplicates', color: 'text-blue-400' },
];

export default function SummaryCards({
  brokenLinks, orphanedImages, orphanedMeta, emptyDirs, corruptedHtml, duplicates,
}: SummaryCardsProps) {
  const counts = [brokenLinks, orphanedImages, orphanedMeta, emptyDirs, corruptedHtml, duplicates];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {cardDefs.map((def, i) => {
        const Icon = def.icon;
        return (
          <div key={def.label} className="bg-surface border border-border rounded-lg p-3 text-center">
            <Icon className={`w-5 h-5 mx-auto mb-1 ${def.color}`} />
            <div className="text-2xl font-bold">{counts[i]}</div>
            <div className="text-xs text-text-muted">{def.label}</div>
          </div>
        );
      })}
    </div>
  );
}