interface SeverityBadgeProps {
  severity: 'error' | 'warning' | 'info';
}

const variants = {
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={`px-2 py-0.5 text-xs font-medium border rounded ${variants[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}