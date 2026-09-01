import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardList, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface UpdateLogTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface LogRow {
  id: string;
  performed_by_name: string | null;
  performed_at: string;
  filters: { field?: string; operator?: string; value?: string }[];
  filter_logic: string | null;
  changes: Record<string, string>;
  affected: number;
}

const CHANGE_LABELS: Record<string, string> = {
  owner_user_id: 'Owner',
  priority: 'Priority',
  opportunity_type: 'Opportunity Type',
  status: 'Status',
  stage: 'Stage',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function UpdateLogTab({ onToast }: UpdateLogTabProps) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [owners, setOwners] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quote_admin_update_log')
        .select('id,performed_by_name,performed_at,filters,filter_logic,changes,affected')
        .order('performed_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const list = (data || []) as LogRow[];
      setRows(list);
      const ownerIds = [...new Set(list.map(r => r.changes?.owner_user_id).filter((v): v is string => !!v))];
      if (ownerIds.length > 0) {
        const { data: users } = await supabase.from('user_profiles').select('id,display_name').in('id', ownerIds);
        const map: Record<string, string> = {};
        for (const u of (users || []) as { id: string; display_name: string | null }[]) map[u.id] = u.display_name || u.id;
        setOwners(map);
      }
    } catch (err) {
      console.error('Error loading update log:', err);
      onToast("We couldn't load the update log.", 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function changeSummary(changes: Record<string, string>): string {
    return Object.entries(changes)
      .map(([k, v]) => `${CHANGE_LABELS[k] || k} \u2192 ${k === 'owner_user_id' ? (owners[v] || '\u2026') : v}`)
      .join(' \u00b7 ');
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><ClipboardList className="w-4 h-4 text-gray-400" /> Quotes Mass Update Log</h2>
          <p className="mt-1 text-sm text-gray-500">Every execution of the Quotes Mass Update tool: who ran it, the selection, the changes applied and how many quotes were affected.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 flex-shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-10 text-center text-sm text-gray-500">
          No mass updates have been executed yet.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8" />
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">When</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">By</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Changes</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Quotes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const open = expanded.has(row.id);
                return (
                  <>
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(row.id)) n.delete(row.id); else n.add(row.id); return n; })}>
                      <td className="pl-3 text-gray-400">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-900">{formatDate(row.performed_at)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{row.performed_by_name || '\u2014'}</td>
                      <td className="px-3 py-2.5 text-gray-700">{changeSummary(row.changes)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{row.affected}</td>
                    </tr>
                    {open && (
                      <tr key={`${row.id}-detail`} className="border-b border-gray-100 bg-gray-50/60">
                        <td />
                        <td colSpan={4} className="px-3 py-3">
                          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Selection</div>
                          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-0.5 mb-2">
                            {(row.filters || []).map((f, i) => (
                              <li key={i}><span className="text-gray-400 mr-1">{i + 1}.</span>{f.field} <span className="text-gray-500">{f.operator}</span> {String(f.value ?? '')}</li>
                            ))}
                            {(row.filters || []).length === 0 && <li>All quotes</li>}
                          </ul>
                          {row.filter_logic && <p className="text-xs text-gray-500 mb-2">Logic: <span className="font-mono">{row.filter_logic}</span></p>}
                          <p className="text-xs text-gray-400">Each affected quote has an "Admin Mass Update" entry in its History with the old and new values.</p>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
