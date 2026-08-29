import { useEffect, useState } from 'react';
import { Activity, PauseCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { Quote } from '../lib/supabase';
import { CollapsibleSection } from './CollapsibleSection';
import { QUOTE_STATUSES, formatDuration, getTimeMetrics } from '../lib/timeTracking';

interface QuoteStatusTimeTrackingProps {
  quote: Quote;
  onStatusChange: (status: string) => void;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${month} / ${String(d.getDate()).padStart(2, '0')} / ${d.getFullYear()} ${hh}:${mm}`;
}

export function QuoteStatusTimeTracking({ quote, onStatusChange }: QuoteStatusTimeTrackingProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const m = getTimeMetrics(quote, now);

  const stateBadge = m.state === 'effective'
    ? { cls: 'bg-green-50 text-green-700 border-green-200', Icon: Activity, label: 'Effective time running' }
    : m.state === 'paused'
      ? { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: PauseCircle, label: 'Paused — hold time running' }
      : m.closedAs === 'won'
        ? { cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: CheckCircle2, label: 'Closed — Won' }
        : { cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle, label: 'Closed — Lost' };

  const metrics = [
    { label: 'Age', value: `${m.ageDays} ${m.ageDays === 1 ? 'day' : 'days'}`, hint: 'Calendar days since creation', running: m.state !== 'closed' },
    { label: 'Total Time', value: formatDuration(m.totalSeconds), hint: 'Creation to close', running: m.state !== 'closed' },
    { label: 'Effective Time', value: formatDuration(m.effectiveSeconds), hint: 'Time being worked', running: m.state === 'effective' },
    { label: 'Hold Time', value: formatDuration(m.pausedSeconds), hint: 'Time On Hold / Waiting for Information', running: m.state === 'paused' },
  ];

  return (
    <CollapsibleSection
      title="Quote Status & Time Tracking"
      storageKey="quote.status_time"
      aside={<span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${stateBadge.cls}`}><stateBadge.Icon className="w-3.5 h-3.5" />{stateBadge.label}</span>}
    >
      <div className="px-6 py-4 grid grid-cols-5 gap-6">
        <div className="space-y-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Status</div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Status</div>
            <select
              value={quote.status || 'Active'}
              onChange={e => onStatusChange(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {QUOTE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Stage</div>
            <div className="text-sm text-gray-900">{quote.stage || 'New'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{m.state === 'closed' ? 'Closed on' : 'In current state since'}</div>
            <div className="text-sm text-gray-900">{formatDateTime(m.state === 'closed' ? quote.closed_at : quote.clock_since)}</div>
            <div className="text-xs text-gray-500">{formatDuration(m.currentStateSeconds)} {m.state === 'closed' ? 'ago' : ''}</div>
          </div>
        </div>

        {metrics.map(x => (
          <div key={x.label} className="space-y-3">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              {x.label}
              {x.running && <Clock className="w-3 h-3 text-green-500" />}
            </div>
            <div className="text-2xl font-bold text-[#0F2A5C] tabular-nums">{x.value}</div>
            <div className="text-xs text-gray-500">{x.hint}</div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
