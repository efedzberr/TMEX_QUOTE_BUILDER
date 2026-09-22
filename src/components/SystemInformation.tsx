import { Info } from 'lucide-react';

export interface AuditedRecord {
  created_at?: string | null;
  created_by_name?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
}

interface SystemInformationProps {
  record: AuditedRecord | null | undefined;
  variant?: 'card' | 'inline';
  className?: string;
}

function fmtDate(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '\u2014', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '\u2014', time: '' };
  return {
    date: d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

function Column({ label, name, iso }: { label: string; name?: string | null; iso?: string | null }) {
  const { date, time } = fmtDate(iso);
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm text-gray-900">{name || 'Unknown'}</div>
      <div className="text-xs text-gray-500">{date}{time ? `, ${time}` : ''}</div>
    </div>
  );
}

export function SystemInformation({ record, variant = 'card', className = '' }: SystemInformationProps) {
  if (!record) return null;
  const body = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
      <Column label="Created By" name={record.created_by_name} iso={record.created_at} />
      <Column label="Last Modified By" name={record.updated_by_name || record.created_by_name} iso={record.updated_at || record.created_at} />
    </div>
  );
  if (variant === 'inline') {
    return (
      <div className={`mt-6 pt-4 border-t border-gray-200 ${className}`}>
        <div className="flex items-center gap-1.5 mb-3">
          <Info className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">System Information</span>
        </div>
        {body}
      </div>
    );
  }
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2">
        <Info className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">System Information</h2>
      </div>
      <div className="px-6 py-4">{body}</div>
    </div>
  );
}
