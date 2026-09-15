import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Filter, X } from 'lucide-react';
import { QuoteHistory as QuoteHistoryType } from '../lib/supabase';
import { QUOTE_FIELD_CATALOG } from '../lib/quoteFieldCatalog';
import { adminObjectFor } from '../lib/adminObjectCatalog';

interface QuoteHistoryProps {
  history: QuoteHistoryType[];
}

type FieldMeta = { label: string; type: string };

const QUOTE_META = new Map<string, FieldMeta>(QUOTE_FIELD_CATALOG.map(f => [f.key, { label: f.label, type: f.dataType }]));
const LANE_META = new Map<string, FieldMeta>(
  (adminObjectFor('quote_lanes_object')?.fields || []).map(f => [f.column, { label: f.label, type: f.type.toLowerCase() }]),
);

function metaFor(entry: QuoteHistoryType): FieldMeta | undefined {
  if (!entry.field) return undefined;
  return (entry.object === 'quote_lane' ? LANE_META : QUOTE_META).get(entry.field);
}

function fieldLabel(entry: QuoteHistoryType): string {
  return metaFor(entry)?.label || entry.field || '';
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

/** Render a raw stored value according to the field's data type. */
function formatValue(raw: string | null | undefined, type?: string): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  switch (type) {
    case 'currency': {
      const n = Number(raw);
      return isNaN(n) ? raw : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case 'number': {
      const n = Number(raw);
      return isNaN(n) ? raw : n.toLocaleString('en-US', { maximumFractionDigits: 4 });
    }
    case 'datetime':
      return isNaN(Date.parse(raw)) ? raw : formatDateTime(raw);
    case 'date': {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
      return m ? `${m[2]}/${m[3]}/${m[1]}` : raw;
    }
    case 'checkbox':
      return raw === 'true' ? 'Yes' : raw === 'false' ? 'No' : raw;
    default:
      return raw;
  }
}

function ValueCell({ value }: { value: string | null }) {
  if (value === null) return <span className="text-gray-300 italic">empty</span>;
  return <span className="break-words">{value}</span>;
}

type Via = NonNullable<QuoteHistoryType['changed_via']>;
const VIA_BADGE: Record<Via, string> = {
  app: 'bg-blue-50 text-blue-700 border-blue-200',
  customer_portal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  system: 'bg-gray-100 text-gray-600 border-gray-200',
};
const VIA_LABEL: Record<Via, string> = { app: 'App', customer_portal: 'Portal', system: 'System' };

export function QuoteHistory({ history }: QuoteHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | 'activity' | 'field_change'>('');
  const [objectFilter, setObjectFilter] = useState<'' | 'quote' | 'quote_lane'>('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fieldOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of history) {
      if (!e.field) continue;
      const key = `${e.object || 'quote'}:${e.field}`;
      if (!seen.has(key)) seen.set(key, `${e.object === 'quote_lane' ? 'Lane \u00b7 ' : ''}${fieldLabel(e)}`);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [history]);

  const userOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of history) s.add(e.user_name);
    return Array.from(s).sort();
  }, [history]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter(e => {
      const type = e.entry_type || 'activity';
      if (typeFilter && type !== typeFilter) return false;
      if (objectFilter && (e.object || 'quote') !== objectFilter) return false;
      if (fieldFilter && `${e.object || 'quote'}:${e.field || ''}` !== fieldFilter) return false;
      if (userFilter && e.user_name !== userFilter) return false;
      if (dateFrom || dateTo) {
        const k = toLocalDateKey(e.date);
        if (dateFrom && k < dateFrom) return false;
        if (dateTo && k > dateTo) return false;
      }
      if (q) {
        const hay = [e.action, e.notes || '', fieldLabel(e), e.field || '', e.old_value || '', e.new_value || '', e.user_name, e.lane_label || '']
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [history, search, typeFilter, objectFilter, fieldFilter, userFilter, dateFrom, dateTo]);

  const hasFilters = !!(search || typeFilter || objectFilter || fieldFilter || userFilter || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch(''); setTypeFilter(''); setObjectFilter(''); setFieldFilter(''); setUserFilter(''); setDateFrom(''); setDateTo('');
  };

  const selectClass = 'px-2.5 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

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
            {history.length} {history.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search action, field, value or user\u2026"
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as '' | 'activity' | 'field_change')} className={selectClass}>
              <option value="">All types</option>
              <option value="activity">Activity</option>
              <option value="field_change">Field change</option>
            </select>
            <select value={objectFilter} onChange={e => setObjectFilter(e.target.value as '' | 'quote' | 'quote_lane')} className={selectClass}>
              <option value="">All objects</option>
              <option value="quote">Quote</option>
              <option value="quote_lane">Quote Lane</option>
            </select>
            <select value={fieldFilter} onChange={e => setFieldFilter(e.target.value)} className={`${selectClass} max-w-[220px]`}>
              <option value="">All fields</option>
              {fieldOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className={`${selectClass} max-w-[200px]`}>
              <option value="">All users</option>
              {userOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={selectClass} title="From" />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={selectClass} title="To" />
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
            Showing {filtered.length} of {history.length} {history.length === 1 ? 'entry' : 'entries'}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-40 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date / Time</th>
                  <th className="w-44 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                  <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action / Field</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Old Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">New Value / Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map(e => {
                  const isField = (e.entry_type || 'activity') === 'field_change';
                  const meta = metaFor(e);
                  const via: Via = e.changed_via || 'app';
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDateTime(e.date)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900 truncate" title={e.user_name}>{e.user_name}</div>
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border ${VIA_BADGE[via]}`}>
                          {VIA_LABEL[via]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${isField ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {isField ? 'Field change' : 'Activity'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{isField ? fieldLabel(e) : e.action}</div>
                        {e.object === 'quote_lane' && e.lane_label && (
                          <div className="text-xs text-gray-500 mt-0.5">{e.lane_label}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {isField ? <ValueCell value={formatValue(e.old_value, meta?.type)} /> : <span className="text-gray-300">{'\u2014'}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {isField
                          ? <ValueCell value={formatValue(e.new_value, meta?.type)} />
                          : <span className="text-gray-600">{e.notes}</span>}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-400">
                      {history.length === 0 ? 'No history yet.' : 'No entries match the current filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
