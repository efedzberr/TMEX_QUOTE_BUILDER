import { useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLog';

export interface TransferUser {
  id: string;
  email: string;
  display_name: string | null;
  active: boolean;
}

interface OtherBlocker {
  table: string;
  column: string;
  count: number;
}

interface RecordSummary {
  quotes: number;
  sales_rep_quotes: number;
  list_views_private: number;
  list_views_public: number;
  kpi_tiles: number;
  other_blockers: OtherBlocker[];
}

interface TransferResult {
  quotes: number;
  us_sales_rep_quotes: number;
  mx_sales_rep_quotes: number;
  list_views: number;
  kpi_tiles: number;
  kpi_tiles_not_moved: number;
  other_blockers: OtherBlocker[];
}

interface TransferRecordsModalProps {
  source: TransferUser;
  candidates: TransferUser[];
  onClose: () => void;
  onTransferred: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

const userLabel = (u: TransferUser) => (u.display_name ? `${u.display_name} · ${u.email}` : u.email);
const userName = (u: TransferUser) => u.display_name || u.email;

export function TransferRecordsModal({ source, candidates, onClose, onTransferred, onToast }: TransferRecordsModalProps) {
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setLoadError(null);
    supabase.rpc('user_record_summary', { p_user: source.id }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setLoadError(error.message);
      else setSummary(data as RecordSummary);
    });
    return () => { cancelled = true; };
  }, [source.id]);

  const target = candidates.find(u => u.id === targetId) || null;
  const transferable = summary
    ? summary.quotes + summary.sales_rep_quotes + summary.list_views_private + summary.list_views_public + summary.kpi_tiles
    : 0;

  async function runTransfer() {
    if (!target || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('transfer_user_records', { p_from: source.id, p_to: target.id });
    setBusy(false);
    if (error) {
      setConfirming(false);
      onToast(`The records were not transferred: ${error.message}`, 'error');
      return;
    }
    const res = data as TransferResult;
    setResult(res);
    setConfirming(false);
    logActivity('User Records Transferred', {
      object: 'user',
      recordId: source.id,
      recordLabel: source.email,
      details: `To ${target.email}: ${res.quotes} quotes, ${res.list_views} list views, ${res.kpi_tiles} KPI tiles`,
    });
    onToast(`Records of ${userName(source)} transferred to ${userName(target)}.`, 'success');
    onTransferred();
  }

  const rows: { label: string; hint?: string; count: number }[] = summary ? [
    { label: 'Quotes owned', hint: 'All stages and statuses, including closed and locked quotes', count: summary.quotes },
    { label: 'Quotes naming the user as Sales Rep', hint: 'US Sales Rep / MX Sales Rep text is replaced with the new user', count: summary.sales_rep_quotes },
    { label: 'Private list views', count: summary.list_views_private },
    { label: 'Public list views', count: summary.list_views_public },
    { label: 'Personal KPI tiles', hint: 'Up to 8 tiles per strip for the receiving user', count: summary.kpi_tiles },
  ] : [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between px-6 pt-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Transfer Records</h2>
            <p className="text-sm text-gray-500 mt-0.5">Move everything {userName(source)} owns to another user.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {loadError && (
            <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>The records of this user could not be read: {loadError}</span>
            </div>
          )}

          {!summary && !loadError && <div className="text-sm text-gray-400 py-6 text-center">Counting records...</div>}

          {summary && !result && (
            <>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Records of {userName(source)}</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 w-20">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(r => (
                      <tr key={r.label}>
                        <td className="px-3 py-2">
                          <div className="text-gray-900">{r.label}</div>
                          {r.hint && <div className="text-xs text-gray-500">{r.hint}</div>}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${r.count > 0 ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500">"Created by", "Last modified by" and the quote history keep the original user. Nothing is deleted.</p>

              {summary.other_blockers.length > 0 && <BlockerNotice blockers={summary.other_blockers} />}

              {transferable === 0 ? (
                <div className="flex items-start gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>This user has no records to transfer.</span>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transfer to <span className="text-red-500">*</span></label>
                  <select
                    value={targetId}
                    onChange={e => { setTargetId(e.target.value); setConfirming(false); }}
                    disabled={busy}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  >
                    <option value="">Select a user...</option>
                    {candidates.map(u => (
                      <option key={u.id} value={u.id}>{userLabel(u)}{u.active ? '' : ' (inactive)'}</option>
                    ))}
                  </select>
                  {target && !target.active && (
                    <p className="mt-1 text-xs text-amber-700">This user is inactive and cannot sign in to work on the records.</p>
                  )}
                </div>
              )}

              {confirming && target && (
                <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    All the records listed above will belong to <strong>{userName(target)}</strong>. This cannot be undone automatically. Transfer now?
                  </span>
                </div>
              )}
            </>
          )}

          {result && target && (
            <>
              <div className="flex items-start gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="flex items-center flex-wrap gap-1">Transfer completed: {userName(source)} <ArrowRight className="w-3.5 h-3.5 inline" /> {userName(target)}</span>
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li><span className="font-semibold tabular-nums">{result.quotes}</span> quotes changed owner</li>
                <li><span className="font-semibold tabular-nums">{result.us_sales_rep_quotes + result.mx_sales_rep_quotes}</span> Sales Rep fields replaced</li>
                <li><span className="font-semibold tabular-nums">{result.list_views}</span> list views transferred</li>
                <li><span className="font-semibold tabular-nums">{result.kpi_tiles}</span> personal KPI tiles transferred</li>
              </ul>
              {result.kpi_tiles_not_moved > 0 && (
                <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{result.kpi_tiles_not_moved} KPI tile(s) were not transferred because {userName(target)} already has 8 tiles in that strip. They are removed if {userName(source)} is deleted.</span>
                </div>
              )}
              {result.other_blockers.length > 0 ? (
                <BlockerNotice blockers={result.other_blockers} />
              ) : (
                <p className="text-sm text-gray-600">{userName(source)} no longer owns records and can be deleted with <span className="font-medium">Delete User</span> in the Actions menu.</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-5">
          {result || !summary || transferable === 0 ? (
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Close</button>
          ) : (
            <>
              <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">Cancel</button>
              {confirming ? (
                <button onClick={runTransfer} disabled={busy || !target} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {busy ? 'Transferring...' : 'Yes, transfer'}
                </button>
              ) : (
                <button onClick={() => setConfirming(true)} disabled={!target} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Transfer Records
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BlockerNotice({ blockers }: { blockers: OtherBlocker[] }) {
  return (
    <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>
        <div>Other references that this process does not transfer still block deleting this user:</div>
        <ul className="mt-1 list-disc list-inside text-xs">
          {blockers.map(b => (
            <li key={`${b.table}.${b.column}`}><span className="font-mono">{b.table}.{b.column}</span>: {b.count}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
