import { Info } from 'lucide-react';

export interface AuditedRecord {
  created_at?: string | null;
  created_by_name?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
}

interface SystemInformationProps {
  record: AuditedRecord | null | undefined;
  /** 'card' = bordered strip on pages; 'inline' = flat strip inside a modal */
  variant?: 'card' | 'inline';
  className?: string;
}

function fmt(iso?: string | null): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '\u2014';
  const date = d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

function Entry({ label, name, iso }: { label: string; name?: string | null; iso?: string | null }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className="text-xs text-gray-800 truncate">{name || 'Unknown'}</span>
      <span className="text-[11px] text-gray-500 whitespace-nowrap">{'\u00b7'} {fmt(iso)}</span>
    </div>
  );
}

export function SystemInformation({ record, variant = 'card', className = '' }: SystemInformationProps) {
  if (!record) return null;
  const body = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
      <Entry label="Created By" name={record.created_by_name} iso={record.created_at} />
      <Entry label="Last Modified By" name={record.updated_by_name || record.created_by_name} iso={record.updated_at || record.created_at} />
    </div>
  );
  if (variant === 'inline') {
    return (
      <div className={`mt-3 pt-2 border-t border-gray-100 ${className}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <Info className="w-3 h-3 text-gray-400" />
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">System Information</span>
        </div>
        {body}
      </div>
    );
  }
  return (
    <div className={`bg-white rounded-lg border border-gray-200 px-5 py-2.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <div className="flex items-center gap-1.5 shrink-0">
          <Info className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">System Information</span>
        </div>
        <div className="flex-1 min-w-[280px]">{body}</div>
      </div>
    </div>
  );
}
