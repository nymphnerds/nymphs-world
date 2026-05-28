import { Loader2 } from 'lucide-react';

interface ScanProgressBarProps {
  userName?: string;
}

export default function ScanProgressBar({ userName }: ScanProgressBarProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-text-muted">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Scanning {userName || 'all users'}...</span>
    </div>
  );
}