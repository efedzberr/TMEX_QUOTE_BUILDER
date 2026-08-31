import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search, Wand2, AlertTriangle, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { QUOTE_FIELD_CATALOG, FieldDataType } from '../../lib/quoteFieldCatalog';
import { getOperatorsForType, getPicklistValues } from '../../lib/quoteFilterEngine';
import { RELATIVE_TOKEN_CATALOG, RELATIVE_TOKEN_MAP, parseRelativeValue } from '../../lib/relativeDates';

function buildRelativeValue(token: string, n: number): string {
  const def = RELATIVE_TOKEN_MAP.get(token);
  return JSON.stringify(def?.takesN ? { token, n } : { token });
}

interface QuotesTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface Criterion {
  field: string;
  operator: string;
  value: string;
}

interface SampleRow {
  quote_number: string;
  generated_quote_name: string | null;
  owner_name: string | null;
  stage: string | null;
  status: string | null;
  priority: string | null;
  opportunity_type: string | null;
}

const FILTERABLE = QUOTE_FIELD_CATALOG.filter(f => !f.computed || ['total_amount', 'due_status', 'age_days', 'total_hours', 'effective_hours', 'hold_hours'].includes(f.key));

const PRIORITIES = ['Standard', 'Low', 'High'];
const OPP_TYPES = ['BID', 'CONTRACT', 'STANDARD PUBLISH'];
const STATUSES = ['Active', 'On Hold', 'Waiting for Information', 'Cancelled'];
const STAGES = ['New', 'In Progress', 'Completed', 'Branch Manager Approval', 'Sent to Customer', 'Published'];

export function QuotesTab({ onToast }: QuotesTabProps) {
  const [criteria, setCriteria] = useState<Criterion[]>([{ field: 'stage', operator: 'equals', value: 'Published' }]);
  const [logic, setLogic] = useState('');
  const [preview, setPreview] = useState<{ total: number; sample: SampleRow[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [users, setUsers] = useState<{ id: string; display_name: string }[]>([]);

  const [chgOwner, setChgOwner] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [chgPriority, setChgPriority] = useState(false);
  const [priority, setPriority] = useState('Standard');
  const [chgOpp, setChgOpp] = useState(false);
  const [opp, setOpp] = useState('BID');
  const [chgStatus, setChgStatus] = useState(false);
  const [status, setStatus] = useState('Active');
  const [chgStage, setChgStage] = useState(false);
  const [stage, setStage] = useState('New');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    supabase.from('user_profiles').select('id,display_name').not('display_name', 'is', null).order('display_name')
      .then(({ data }) => setUsers(((data || []) as { id: string; display_name: string | null }[])
        .filter(u => u.display_name && u.display_name.trim())
        .map(u => ({ id: u.id, display_name: u.display_name!.trim() }))));
  }, []);

  const changes = useMemo(() => {
    const c: Record<string, string> = {};
    if (chgOwner && ownerId) c.owner_user_id = ownerId;
    if (chgPriority) c.priority = priority;
    if (chgOpp) c.opportunity_type = opp;
    if (chgStatus) c.status = status;
    if (chgStage) c.stage = stage;
    return c;
  }, [chgOwner, ownerId, chgPriority, priority, chgOpp, opp, chgStatus, status, chgStage, stage]);

  const changesSummary = useMemo(() => {
    const parts: string[] = [];
    if (changes.owner_user_id) parts.push(`Owner → ${users.find(u => u.id === changes.owner_user_id)?.display_name || '?'}`);
    if (changes.priority) parts.push(`Priority → ${changes.priority}`);
    if (changes.opportunity_type) parts.push(`Opportunity Type → ${changes.opportunity_type}`);
    if (changes.status) parts.push(`Status → ${changes.status}`);
    if (changes.stage) parts.push(`Stage → ${changes.stage}`);
    return parts;
  }, [changes, users]);

  function updateCriterion(i: number, patch: Partial<Criterion>) {
    setCriteria(prev => prev.map((c, j) => {
      if (j !== i) return c;
      const next = { ...c, ...patch };
      if (patch.field) {
        const def = FILTERABLE.find(f => f.key === patch.field);
        const ops = getOperatorsForType((def?.dataType || 'text') as FieldDataType);
        next.operator = ops[0]?.value || 'equals';
        const pick = getPicklistValues(patch.field);
        next.value = pick ? pick[0] : '';
      }
      return next;
    }));
    setPreview(null);
  }

  async function runPreview() {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.rpc('admin_preview_quotes', {
        p_filters: criteria.filter(c => c.field && c.operator),
        p_logic: logic.trim() || null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setPreview({ total: Number(row?.total ?? 0), sample: (row?.sample || []) as SampleRow[] });
    } catch (err) {
      console.error('Error previewing:', err);
      const msg = String((err as { message?: string } | null)?.message ?? '');
      onToast(msg.includes('logic') || msg.includes('Unsupported') ? msg : "We couldn't run the preview.", 'error');
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function runUpdate() {
    if (!preview) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc('admin_mass_update_quotes', {
        p_filters: criteria.filter(c => c.field && c.operator),
        p_logic: logic.trim() || null,
        p_changes: changes,
        p_expected: preview.total,
      });
      if (error) throw error;
      onToast(`${data} quote${data === 1 ? '' : 's'} updated.`, 'success');
      setConfirmOpen(false);
      setConfirmText('');
      setPreview(null);
    } catch (err) {
      console.error('Error updating:', err);
      const msg = String((err as { message?: string } | null)?.message ?? '');
      onToast(msg.includes('changed (now') ? msg : "We couldn't run the update.", 'error');
    } finally {
      setRunning(false);
    }
  }

  function renderValueInput(c: Criterion, i: number) {
    const def = FILTERABLE.find(f => f.key === c.field);
    const type = (def?.dataType || 'text') as FieldDataType;
    const pick = getPicklistValues(c.field);
    const cls = 'flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
    if (pick) {
      return (
        <select value={c.value} onChange={e => updateCriterion(i, { value: e.target.value })} className={cls}>
          {pick.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }
    if (type === 'date' || type === 'datetime') {
      const rel = parseRelativeValue(c.value);
      return (
        <div className="flex-1 flex gap-1.5">
          <select
            value={rel ? rel.token : '_abs'}
            onChange={e => updateCriterion(i, { value: e.target.value === '_abs' ? '' : buildRelativeValue(e.target.value, 7) })}
            className="w-36 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="_abs">Exact date…</option>
            {RELATIVE_TOKEN_CATALOG.map(t => <option key={t.token} value={t.token}>{t.label}</option>)}
          </select>
          {rel ? (
            (RELATIVE_TOKEN_MAP.get(rel.token)?.takesN ?? false) && (
              <input type="number" min={1} value={rel.n ?? 7} onChange={e => updateCriterion(i, { value: buildRelativeValue(rel.token, Number(e.target.value) || 1) })} className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md" />
            )
          ) : (
            <input type="date" value={c.value} onChange={e => updateCriterion(i, { value: e.target.value })} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md" />
          )}
        </div>
      );
    }
    if (type === 'number' || type === 'currency') {
      return <input type="number" value={c.value} onChange={e => updateCriterion(i, { value: e.target.value })} className={cls} />;
    }
    return <input type="text" value={c.value} onChange={e => updateCriterion(i, { value: e.target.value })} className={cls} placeholder="Value" />;
  }

  const canPreview = criteria.length > 0 && criteria.every(c => c.field && c.operator);
  const canRun = preview !== null && preview.total > 0 && Object.keys(changes).length > 0 && (!chgOwner || !!ownerId);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><Wand2 className="w-4 h-4 text-gray-400" /> Quotes Mass Update</h2>
        <p className="mt-1 text-sm text-gray-500">
          Select quotes with list-view filters, preview the matches, choose the properties to set, and apply them to every match.
          Administrator tool: it updates quotes regardless of sharing rules and stage locks. Every quote gets a History entry and the operation is logged.
        </p>
      </section>

      {/* 1. Filters */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">1. Select quotes</h3>
        <div className="space-y-2">
          {criteria.map((c, i) => {
            const def = FILTERABLE.find(f => f.key === c.field);
            const ops = getOperatorsForType((def?.dataType || 'text') as FieldDataType);
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-5 text-xs text-gray-400 text-right">{i + 1}</span>
                <select value={c.field} onChange={e => updateCriterion(i, { field: e.target.value })} className="w-48 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white">
                  {FILTERABLE.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <select value={c.operator} onChange={e => { updateCriterion(i, { operator: e.target.value }); }} className="w-40 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white">
                  {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {renderValueInput(c, i)}
                <button onClick={() => { setCriteria(prev => prev.filter((_, j) => j !== i)); setPreview(null); }} className="p-1.5 text-gray-400 hover:text-red-600" title="Remove"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-4">
          <button onClick={() => { setCriteria(prev => [...prev, { field: 'stage', operator: 'equals', value: 'New' }]); setPreview(null); }} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"><Plus className="w-3.5 h-3.5" /> Add filter</button>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            Filter logic <span className="text-gray-400">(optional, e.g. 1 AND (2 OR 3))</span>
            <input type="text" value={logic} onChange={e => { setLogic(e.target.value); setPreview(null); }} className="w-44 px-2 py-1 text-xs border border-gray-300 rounded-md" placeholder="Blank = all with AND" />
          </label>
        </div>
      </section>

      {/* 2. Preview */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-sm font-semibold text-gray-800">2. Preview</h3>
          <button onClick={runPreview} disabled={!canPreview || previewing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
            <Search className="w-3.5 h-3.5" /> {previewing ? 'Counting...' : 'Run preview'}
          </button>
          {preview && <span className="text-sm text-gray-700"><strong>{preview.total}</strong> matching quote{preview.total === 1 ? '' : 's'}</span>}
        </div>
        {preview && preview.sample.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Quote', 'Name', 'Owner', 'Stage', 'Status', 'Priority', 'Opp. Type'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map(r => (
                  <tr key={r.quote_number} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">{r.quote_number}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[220px] truncate">{r.generated_quote_name || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.owner_name || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.stage || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.status || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.priority || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.opportunity_type || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.total > preview.sample.length && (
              <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">Showing the {preview.sample.length} most recent of {preview.total}.</div>
            )}
          </div>
        )}
      </section>

      {/* 3. Changes */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">3. Set properties</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
          <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
            <input type="checkbox" checked={chgOwner} onChange={e => setChgOwner(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700 w-16">Owner</span>
            <select value={ownerId} disabled={!chgOwner} onChange={e => setOwnerId(e.target.value)} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white disabled:opacity-50">
              <option value="">Select user…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
            <input type="checkbox" checked={chgPriority} onChange={e => setChgPriority(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700 w-16">Priority</span>
            <select value={priority} disabled={!chgPriority} onChange={e => setPriority(e.target.value)} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white disabled:opacity-50">
              {PRIORITIES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
            <input type="checkbox" checked={chgOpp} onChange={e => setChgOpp(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700 w-16">Opp. Type</span>
            <select value={opp} disabled={!chgOpp} onChange={e => setOpp(e.target.value)} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white disabled:opacity-50">
              {OPP_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
            <input type="checkbox" checked={chgStatus} onChange={e => setChgStatus(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700 w-16">Status</span>
            <select value={status} disabled={!chgStatus} onChange={e => setStatus(e.target.value)} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white disabled:opacity-50">
              {STATUSES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
            <input type="checkbox" checked={chgStage} onChange={e => setChgStage(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700 w-16">Stage</span>
            <select value={stage} disabled={!chgStage} onChange={e => setStage(e.target.value)} className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white disabled:opacity-50">
              {STAGES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
        {(chgStage || chgStatus) && (
          <p className="mt-2 text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Changing Stage or Status moves the time-tracking clocks (close, pause or resume) exactly as a manual change would.</p>
        )}
      </section>

      {/* 4. Apply */}
      <section>
        <button
          onClick={() => { setConfirmText(''); setConfirmOpen(true); }}
          disabled={!canRun}
          title={!preview ? 'Run the preview first' : Object.keys(changes).length === 0 ? 'Choose at least one property to set' : undefined}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          <ClipboardList className="w-4 h-4" /> Update {preview ? preview.total : ''} quote{preview && preview.total === 1 ? '' : 's'}…
        </button>
      </section>

      {confirmOpen && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !running && setConfirmOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Confirm mass update</h3>
            <p className="text-sm text-gray-600 mb-3">You are about to update <strong>{preview.total}</strong> quote{preview.total === 1 ? '' : 's'}:</p>
            <ul className="text-sm text-gray-800 mb-4 list-disc pl-5 space-y-0.5">
              {changesSummary.map(x => <li key={x}>{x}</li>)}
            </ul>
            <p className="text-sm text-gray-600 mb-2">Type <strong>{preview.total}</strong> to confirm:</p>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoFocus className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setConfirmOpen(false)} disabled={running} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={runUpdate} disabled={running || confirmText.trim() !== String(preview.total)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{running ? 'Updating...' : 'Update'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
