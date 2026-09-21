import { Clock } from 'lucide-react';

interface RecordAuditInfoProps {
  createdAt?: string | null;
  createdByName?: string | null;
  updatedAt?: string | null;
  updatedByName?: string | null;
  compact?: boolean;
}

function fmt(iso?: string | null): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function RecordAuditInfo({ createdAt, createdByName, updatedAt, updatedByName, compact = false }: RecordAuditInfoProps) {
  const created = `${createdByName || 'Unknown'}, ${fmt(createdAt)}`;
  const modified = `${updatedByName || createdByName || 'Unknown'}, ${fmt(updatedAt || createdAt)}`;
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500" title={`Created By ${created} \u00b7 Last Modified By ${modified}`}>
        <Clock className="w-3 h-3" />
        <span>Created By {created}</span>
        <span className="text-gray-300">{'\u00b7'}</span>
        <span>Last Modified By {modified}</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500">
      <div><span className="uppercase tracking-wide text-[10px] text-gray-400">Created By</span><div className="text-gray-700">{created}</div></div>
      <div><span className="uppercase tracking-wide text-[10px] text-gray-400">Last Modified By</span><div className="text-gray-700">{modified}</div></div>
    </div>
  );
}
