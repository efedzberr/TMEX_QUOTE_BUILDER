import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Filter, X } from 'lucide-react';
import { QuoteHistory as QuoteHistoryType, QuoteFieldHistory } from '../lib/supabase';
import { QUOTE_FIELD_CATALOG } from '../lib/quoteFieldCatalog';
import { adminObjectFor } from '../lib/adminObjectCatalog';

interface QuoteHistoryProps {
  history: QuoteHistoryType[];
  fieldHistory?: QuoteFieldHistory[];
}

type HistoryTab = 'activity' | 'fields';

const QUOTE_LABELS = new Map(QUOTE_FIELD_CATALOG.map(f => [f.key, f.label]));
const LANE_LABELS = new Map((adminObjectFor('quote_lanes_object')?.fields || []).map(f => [f.column, f.label]));

function fieldLabel(entry: QuoteFieldHistory): string {
  const map = entry.object === 'quote_lane' ? LANE_LABELS : QUOTE_LABELS;
  return map.get(entry.field) || entry.field;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function ValueCell({ value }: { value: string | null }) {
  if (value === null || value === '') return <span className="text-gray-300 italic">empty</span>;
  return <span className="break-words">{value}</span>;
}

const VIA_BADGE: Record<QuoteFieldHistory['changed_via'], string> = {
  app: 'bg-blue-50 text-blue-700 border-blue-200',
  customer_portal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  system: 'bg-gray-100 text-gray-600 border-gray-200',
};
const VIA_LABEL: Record<QuoteFieldHistory['changed_via'], string> = {
  app: 'App', customer_portal: 'Portal', system: 'System',
};

export function QuoteHistory({ history, fieldHistory = [] }: QuoteHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tab, setTab] = useState<HistoryTab>('activity');

  // Field History filters
  const [search, setSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [objectFilter, setObjectFilter] = useState<'' | 'quote' | 'quote_lane'>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fieldOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of fieldHistory) {
      const key = `${e.object}:${e.field}`;
      if (!seen.has(key)) seen.set(key, `${e.object === 'quote_lane' ? 'Lane \u00b7 ' : ''}${fieldLabel(e)}`);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fieldHistory]);

  const userOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of fieldHistory) s.add(e.changed_by_name);
    return Array.from(s).sort();
  }, [fieldHistory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fieldHistory.filter(e => {
      if (objectFilter && e.object !== objectFilter) return false;
      if (fieldFilter && `${e.object}:${e.field}` !== fieldFilter) return false;
      if (userFilter && e.changed_by_name !== userFilter) return false;
      if (dateFrom || dateTo) {
        const k = toLocalDateKey(e.changed_at);
        if (dateFrom && k < dateFrom) return false;
        if (dateTo && k > dateTo) return false;
      }
      if (q) {
        const hay = [
          fieldLabel(e), e.field, e.old_value || '', e.new_value || '', e.changed_by_name, e.lane_label || '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [fieldHistory, search, fieldFilter, userFilter, objectFilter, dateFrom, dateTo]);

  const hasFilters = !!(search || fieldFilter || userFilter || objectFilter || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch(''); setFieldFilter(''); setUserFilter(''); setObjectFilter(''); setDateFrom(''); setDateTo('');
  };

  const entryCount = tab === 'activity' ? history.length : fieldHistory.length;

  return (
    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-600" />
          )}
          <h2 className="text-lg font-semibold text-gray-900">Quote History</h2>
          <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          <div className="flex gap-6 border-b border-gray-200 mb-4">
            <button
              onClick={() => setTab('activity')}
              className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'activity' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Activity <span className="ml-1 text-xs text-gray-400">({history.length})</span>
            </button>
            <button
              onClick={() => setTab('fields')}
              className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'fields' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Field History <span className="ml-1 text-xs text-gray-400">({fieldHistory.length})</span>
            </button>
          </div>

          {tab === 'activity' && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(entry.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{entry.user_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{entry.action}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.notes}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-gray-400">No activity yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'fields' && (
            <div>
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search field, value or user\u2026"
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
                <select
                  value={objectFilter}
                  onChange={e => setObjectFilter(e.target.value as '' | 'quote' | 'quote_lane')}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All objects</option>
                  <option value="quote">Quote</option>
                  <option value="quote_lane">Quote Lane</option>
                </select>
                <select
                  value={fieldFilter}
                  onChange={e => setFieldFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[220px]"
                >
                  <option value="">All fields</option>
                  {fieldOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <select
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                >
                  <option value="">All users</option>
                  {userOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="From"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="To"
                  />
                </div>
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 bg-white"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                <Filter className="w-3.5 h-3.5" />
                Showing {filtered.length} of {fieldHistory.length} change{fieldHistory.length === 1 ? '' : 's'}
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-40 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date / Time</th>
                      <th className="w-44 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Field</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Old Value</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">New Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtered.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors align-top">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDateTime(e.changed_at)}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900 truncate" title={e.changed_by_name}>{e.changed_by_name}</div>
                          <span className={`inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border ${VIA_BADGE[e.changed_via]}`}>
                            {VIA_LABEL[e.changed_via]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>{fieldLabel(e)}</div>
                          {e.object === 'quote_lane' && e.lane_label && (
                            <div className="text-xs text-gray-500 mt-0.5">{e.lane_label}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500"><ValueCell value={e.old_value} /></td>
                        <td className="px-4 py-3 text-sm text-gray-900"><ValueCell value={e.new_value} /></td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400">
                          {fieldHistory.length === 0
                            ? 'No field changes recorded yet. Tracked fields are configured in Administration \u2192 Objects & Fields \u2192 History Tracking.'
                            : 'No changes match the current filters.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
