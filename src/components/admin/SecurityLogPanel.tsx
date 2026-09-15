import { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Tab = 'logins' | 'sessions' | 'activity';

interface LoginRow { id: number; user_id: string | null; email: string; status: string; ip: string | null; user_agent: string | null; created_at: string }
interface SessionRow { session_id: string; user_id: string; started_at: string; last_activity_at: string; ended_at: string | null; end_reason: string | null }
interface ActivityRow { id: number; user_id: string | null; user_name: string; event: string; object: string | null; record_id: string | null; record_label: string | null; details: string | null; source: string; created_at: string }
interface UserOption { id: string; display_name: string | null }

interface SecurityLogPanelProps {
  /** Restrict to one user. Omit for the global admin view. */
  userId?: string;
  /** Show the user filter (global admin view). */
  showUserFilter?: boolean;
  initialTab?: Tab;
  /** Bump to force a reload (e.g. after ending sessions). */
  refreshKey?: number;
}

const ROW_LIMIT = 500;

const STATUS_LABEL: Record<string, string> = {
  success: 'Success',
  invalid_credentials: 'Invalid password',
  locked: 'Locked',
  unknown_user: 'Unknown user',
  error: 'Error',
};
const STATUS_BADGE: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  invalid_credentials: 'bg-red-50 text-red-700 border-red-200',
  locked: 'bg-amber-50 text-amber-700 border-amber-200',
  unknown_user: 'bg-gray-100 text-gray-600 border-gray-200',
  error: 'bg-gray-100 text-gray-600 border-gray-200',
};
const END_LABEL: Record<string, string> = { logout: 'Signed out', timeout: 'Timed out', admin: 'Ended by admin' };

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDuration(startIso: string, endIso: string | null): string {
  const ms = (endIso ? new Date(endIso).getTime() : Date.now()) - new Date(startIso).getTime();
  if (ms < 0) return '—';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Short browser / OS description from a user agent string. */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return '—';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  let os = '';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return os ? `${browser} · ${os}` : browser;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const lines = [header.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SecurityLogPanel({ userId, showUserFilter = false, initialTab = 'logins', refreshKey = 0 }: SecurityLogPanelProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [users, setUsers] = useState<Map<string, string>>(new Map());

  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let lq = supabase.from('login_history').select('*').order('created_at', { ascending: false }).limit(ROW_LIMIT);
        let sq = supabase.from('user_sessions').select('*').order('started_at', { ascending: false }).limit(ROW_LIMIT);
        let aq = supabase.from('user_activity_log').select('*').order('created_at', { ascending: false }).limit(ROW_LIMIT);
        if (userId) { lq = lq.eq('user_id', userId); sq = sq.eq('user_id', userId); aq = aq.eq('user_id', userId); }
        const [l, s, a, u] = await Promise.all([
          lq, sq, aq,
          supabase.from('user_profiles').select('id, display_name'),
        ]);
        if (cancelled) return;
        const firstError = l.error || s.error || a.error;
        if (firstError) { setError(firstError.message); setLoading(false); return; }
        setLogins((l.data || []) as LoginRow[]);
        setSessions((s.data || []) as SessionRow[]);
        setActivity((a.data || []) as ActivityRow[]);
        const map = new Map<string, string>();
        for (const row of (u.data || []) as UserOption[]) map.set(row.id, row.display_name || row.id);
        setUsers(map);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Error loading logs'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const userName = (id: string | null) => (id ? users.get(id) || id : '—');

  const inDateRange = (iso: string) => {
    if (!dateFrom && !dateTo) return true;
    const k = toLocalDateKey(iso);
    if (dateFrom && k < dateFrom) return false;
    if (dateTo && k > dateTo) return false;
    return true;
  };

  const q = search.trim().toLowerCase();

  const filteredLogins = useMemo(() => logins.filter(r =>
    (!userFilter || r.user_id === userFilter) &&
    (!statusFilter || r.status === statusFilter) &&
    inDateRange(r.created_at) &&
    (!q || [r.email, r.ip || '', describeUserAgent(r.user_agent), userName(r.user_id)].join(' ').toLowerCase().includes(q))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [logins, userFilter, statusFilter, dateFrom, dateTo, q, users]);

  const filteredSessions = useMemo(() => sessions.filter(r =>
    (!userFilter || r.user_id === userFilter) &&
    (!statusFilter || (statusFilter === 'active' ? r.ended_at === null : r.end_reason === statusFilter)) &&
    inDateRange(r.started_at) &&
    (!q || userName(r.user_id).toLowerCase().includes(q))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [sessions, userFilter, statusFilter, dateFrom, dateTo, q, users]);

  const filteredActivity = useMemo(() => activity.filter(r =>
    (!userFilter || r.user_id === userFilter) &&
    (!statusFilter || r.event === statusFilter) &&
    inDateRange(r.created_at) &&
    (!q || [r.user_name, r.event, r.record_label || '', r.details || ''].join(' ').toLowerCase().includes(q))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [activity, userFilter, statusFilter, dateFrom, dateTo, q]);

  const eventOptions = useMemo(() => Array.from(new Set(activity.map(a => a.event))).sort(), [activity]);
  const userOptions = useMemo(() => Array.from(users.entries()).sort((a, b) => a[1].localeCompare(b[1])), [users]);

  const hasFilters = !!(search || userFilter || statusFilter || dateFrom || dateTo);
  const clearFilters = () => { setSearch(''); setUserFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); };
  const switchTab = (t: Tab) => { setTab(t); setStatusFilter(''); };

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (tab === 'logins') {
      downloadCsv(`login-history-${stamp}.csv`, ['Date/Time', 'User', 'Email', 'Status', 'IP', 'Browser', 'User agent'],
        filteredLogins.map(r => [formatDateTime(r.created_at), userName(r.user_id), r.email, STATUS_LABEL[r.status] || r.status, r.ip, describeUserAgent(r.user_agent), r.user_agent]));
    } else if (tab === 'sessions') {
      downloadCsv(`sessions-${stamp}.csv`, ['User', 'Started', 'Last activity', 'Ended', 'Duration', 'End reason'],
        filteredSessions.map(r => [userName(r.user_id), formatDateTime(r.started_at), formatDateTime(r.last_activity_at), r.ended_at ? formatDateTime(r.ended_at) : '', formatDuration(r.started_at, r.ended_at), r.ended_at ? (END_LABEL[r.end_reason || ''] || r.end_reason) : 'Active']));
    } else {
      downloadCsv(`activity-${stamp}.csv`, ['Date/Time', 'User', 'Event', 'Object', 'Record', 'Details', 'Source'],
        filteredActivity.map(r => [formatDateTime(r.created_at), r.user_name, r.event, r.object, r.record_label, r.details, r.source]));
    }
  };

  const count = tab === 'logins' ? filteredLogins.length : tab === 'sessions' ? filteredSessions.length : filteredActivity.length;
  const total = tab === 'logins' ? logins.length : tab === 'sessions' ? sessions.length : activity.length;
  const selectClass = 'px-2.5 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  const tabClass = (t: Tab) => `pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

  return (
    <div>
      <div className="flex gap-6 border-b border-gray-200 mb-4">
        <button onClick={() => switchTab('logins')} className={tabClass('logins')}>Login History <span className="ml-1 text-xs text-gray-400">({logins.length})</span></button>
        <button onClick={() => switchTab('sessions')} className={tabClass('sessions')}>Sessions <span className="ml-1 text-xs text-gray-400">({sessions.length})</span></button>
        <button onClick={() => switchTab('activity')} className={tabClass('activity')}>Activity <span className="ml-1 text-xs text-gray-400">({activity.length})</span></button>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {showUserFilter && (
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className={`${selectClass} max-w-[220px]`}>
            <option value="">All users</option>
            {userOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        {tab === 'logins' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        {tab === 'sessions' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="">All sessions</option>
            <option value="active">Active</option>
            <option value="logout">Signed out</option>
            <option value="timeout">Timed out</option>
            <option value="admin">Ended by admin</option>
          </select>
        )}
        {tab === 'activity' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${selectClass} max-w-[220px]`}>
            <option value="">All events</option>
            {eventOptions.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={selectClass} title="From" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={selectClass} title="To" />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 bg-white">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <button onClick={exportCsv} disabled={count === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white disabled:opacity-50">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
        <Filter className="w-3.5 h-3.5" /> Showing {count} of {total}{total >= ROW_LIMIT ? ` (latest ${ROW_LIMIT})` : ''}
      </div>

      {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {loading ? (
          <p className="px-4 py-6 text-center text-xs text-gray-400">Loading…</p>
        ) : tab === 'logins' ? (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date / Time</th>
                {showUserFilter && <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>}
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IP</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Browser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogins.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-900">{formatDateTime(r.created_at)}</td>
                  {showUserFilter && <td className="px-4 py-2.5 text-gray-900">{userName(r.user_id)}</td>}
                  <td className="px-4 py-2.5 text-gray-700">{r.email}</td>
                  <td className="px-4 py-2.5"><span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_BADGE[r.status] || STATUS_BADGE.error}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.ip || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600" title={r.user_agent || ''}>{describeUserAgent(r.user_agent)}</td>
                </tr>
              ))}
              {filteredLogins.length === 0 && <tr><td colSpan={showUserFilter ? 6 : 5} className="px-4 py-6 text-center text-xs text-gray-400">No login attempts found.</td></tr>}
            </tbody>
          </table>
        ) : tab === 'sessions' ? (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {showUserFilter && <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>}
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Started</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last activity</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ended</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSessions.map(r => (
                <tr key={r.session_id} className="hover:bg-gray-50">
                  {showUserFilter && <td className="px-4 py-2.5 text-gray-900">{userName(r.user_id)}</td>}
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-900">{formatDateTime(r.started_at)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{formatDateTime(r.last_activity_at)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{r.ended_at ? formatDateTime(r.ended_at) : '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{formatDuration(r.started_at, r.ended_at)}</td>
                  <td className="px-4 py-2.5">
                    {r.ended_at
                      ? <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full border bg-gray-100 text-gray-600 border-gray-200">{END_LABEL[r.end_reason || ''] || r.end_reason}</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>}
                  </td>
                </tr>
              ))}
              {filteredSessions.length === 0 && <tr><td colSpan={showUserFilter ? 6 : 5} className="px-4 py-6 text-center text-xs text-gray-400">No sessions found.</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date / Time</th>
                {showUserFilter && <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>}
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Event</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Record</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredActivity.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-900">{formatDateTime(r.created_at)}</td>
                  {showUserFilter && <td className="px-4 py-2.5 text-gray-900">{r.user_name}</td>}
                  <td className="px-4 py-2.5 text-gray-900">{r.event}</td>
                  <td className="px-4 py-2.5 text-gray-700">{r.record_label || (r.object ? r.object : '—')}</td>
                  <td className="px-4 py-2.5 text-gray-600 break-words max-w-md">{r.details || ''}</td>
                </tr>
              ))}
              {filteredActivity.length === 0 && <tr><td colSpan={showUserFilter ? 5 : 4} className="px-4 py-6 text-center text-xs text-gray-400">No activity found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
