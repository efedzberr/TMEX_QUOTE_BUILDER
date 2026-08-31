import { useState, useEffect, useCallback } from 'react';
import { Search, Play, AlertTriangle, CheckCircle, Loader2, History, ChevronDown, ChevronUp, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface QuotesAdminTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface QuotePreview {
  quote_number: string | null;
  generated_quote_name: string | null;
  owner_name: string | null;
  stage: string | null;
  status: string | null;
  priority: string | null;
  opportunity_type: string | null;
}

interface LogEntry {
  id: string;
  performed_by_name: string | null;
  performed_at: string;
  filters: FilterCriterion[];
  filter_logic: string | null;
  changes: Record<string, string>;
  affected: number;
}

interface FilterCriterion {
  field: string;
  operator: string;
  value: string;
}

interface UserOption {
  id: string;
  display_name: string;
}

const STAGES = ['New', 'In Progress', 'Completed', 'Branch Manager Approval', 'Sent to Customer', 'Published'];
const STATUSES = ['Active', 'On Hold', 'Waiting for Information', 'Cancelled'];
const PRIORITIES = ['Standard', 'Low', 'High'];
const OPPORTUNITY_TYPES = ['BID', 'CONTRACT', 'STANDARD PUBLISH'];

const FILTER_FIELDS = [
  { key: 'stage', label: 'Stage', type: 'picklist', options: STAGES },
  { key: 'status', label: 'Status', type: 'picklist', options: STATUSES },
  { key: 'priority', label: 'Priority', type: 'picklist', options: PRIORITIES },
  { key: 'opportunity_type', label: 'Opportunity Type', type: 'picklist', options: OPPORTUNITY_TYPES },
  { key: 'owner_name', label: 'Owner', type: 'text' },
  { key: 'partner_account', label: 'Partner Account', type: 'text' },
  { key: 'bill_to_customer', label: 'Account', type: 'text' },
  { key: 'generated_quote_name', label: 'Quote Name', type: 'text' },
];

const TEXT_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equal', label: 'not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
];
const PICKLIST_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equal', label: 'not equal' },
];

type Step = 'filters' | 'preview' | 'changes' | 'log';

export function QuotesAdminTab({ onToast }: QuotesAdminTabProps) {
  const [step, setStep] = useState<Step>('filters');
  const [criteria, setCriteria] = useState<FilterCriterion[]>([{ field: 'stage', operator: 'equals', value: 'In Progress' }]);
  const [filterLogic, setFilterLogic] = useState('');
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<QuotePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [changeOwner, setChangeOwner] = useState('');
  const [changePriority, setChangePriority] = useState('');
  const [changeOppType, setChangeOppType] = useState('');
  const [changeStatus, setChangeStatus] = useState('');
  const [changeStage, setChangeStage] = useState('');

  const [users, setUsers] = useState<UserOption[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    supabase.from('user_profiles').select('id, display_name').order('display_name').then(({ data }) => {
      setUsers((data || []).filter(u => u.display_name).map(u => ({ id: u.id, display_name: u.display_name })));
    });
  }, []);

  const validCriteria = criteria.filter(c => c.field && c.operator && c.value);

  const handlePreview = useCallback(async () => {
    if (validCriteria.length === 0) { onToast('Add at least one filter before previewing.', 'error'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_preview_quotes', {
        p_filters: validCriteria,
        p_logic: filterLogic || null,
      });
      if (error) throw error;
      const row = (data as { total: number; sample: QuotePreview[] }[])?.[0];
      setPreviewTotal(row?.total ?? 0);
      setPreviewSample(row?.sample ?? []);
      setStep('preview');
    } catch (err) {
      onToast(String((err as { message?: string })?.message || 'Preview failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [validCriteria, filterLogic, onToast]);

  const buildChanges = useCallback((): Record<string, string> => {
    const c: Record<string, string> = {};
    if (changeOwner) c.owner_user_id = changeOwner;
    if (changePriority) c.priority = changePriority;
    if (changeOppType) c.opportunity_type = changeOppType;
    if (changeStatus) c.status = changeStatus;
    if (changeStage) c.stage = changeStage;
    return c;
  }, [changeOwner, changePriority, changeOppType, changeStatus, changeStage]);

  const handleExecute = useCallback(async () => {
    const changes = buildChanges();
    if (Object.keys(changes).length === 0) { onToast('Select at least one change to apply.', 'error'); return; }
    if (previewTotal === null || previewTotal === 0) { onToast('No quotes to update.', 'error'); return; }
    setExecuting(true);
    try {
      const { data, error } = await supabase.rpc('admin_mass_update_quotes', {
        p_filters: validCriteria,
        p_logic: filterLogic || null,
        p_changes: changes,
        p_expected: previewTotal,
      });
      if (error) throw error;
      const affected = typeof data === 'number' ? data : 0;
      onToast(`${affected} quote${affected === 1 ? '' : 's'} updated successfully.`, 'success');
      resetForm();
    } catch (err) {
      onToast(String((err as { message?: string })?.message || 'Update failed'), 'error');
    } finally {
      setExecuting(false);
    }
  }, [buildChanges, validCriteria, filterLogic, previewTotal, onToast]);

  function resetForm() {
    setStep('filters');
    setCriteria([{ field: 'stage', operator: 'equals', value: '' }]);
    setFilterLogic('');
    setPreviewTotal(null);
    setPreviewSample([]);
    setChangeOwner(''); setChangePriority(''); setChangeOppType(''); setChangeStatus(''); setChangeStage('');
  }

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data } = await supabase
        .from('quote_admin_update_log')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(50);
      setLogs((data || []) as LogEntry[]);
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  }, []);

  function addCriterion() {
    setCriteria(prev => [...prev, { field: FILTER_FIELDS[0].key, operator: 'equals', value: '' }]);
  }

  function removeCriterion(index: number) {
    setCriteria(prev => prev.filter((_, i) => i !== index));
  }

  function updateCriterion(index: number, patch: Partial<FilterCriterion>) {
    setCriteria(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const updated = { ...c, ...patch };
      if (patch.field && patch.field !== c.field) {
        const def = FILTER_FIELDS.find(f => f.key === patch.field);
        updated.operator = 'equals';
        updated.value = '';
        if (!def) return updated;
      }
      return updated;
    }));
  }

  const hasChanges = !!(changeOwner || changePriority || changeOppType || changeStatus || changeStage);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900">Admin Quote Mass Update</h2>
          <p className="text-xs text-gray-500 mt-0.5">Bulk-change properties on quotes matching your filters. Bypasses stage locks and sharing rules.</p>
        </div>
        <button
          onClick={() => { if (step === 'log') { setStep('filters'); } else { setStep('log'); loadLogs(); } }}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 font-medium"
        >
          {step === 'log' ? <><X className="w-4 h-4" /> Close Log</> : <><History className="w-4 h-4" /> View Log</>}
        </button>
      </div>

      {step === 'log' ? (
        <LogView logs={logs} loading={logsLoading} />
      ) : (
        <div className="space-y-5">
          {/* Filters */}
          <section className="bg-gray-50 border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">1. Filter quotes</h3>
              <button onClick={addCriterion} className="text-xs font-medium text-blue-600 hover:text-blue-700">+ Add filter</button>
            </div>
            <div className="space-y-2">
              {criteria.map((c, i) => {
                const fieldDef = FILTER_FIELDS.find(f => f.key === c.field);
                const operators = fieldDef?.type === 'picklist' ? PICKLIST_OPERATORS : TEXT_OPERATORS;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                    <select value={c.field} onChange={e => updateCriterion(i, { field: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white min-w-[150px]">
                      {FILTER_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                    <select value={c.operator} onChange={e => updateCriterion(i, { operator: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white min-w-[120px]">
                      {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {fieldDef?.type === 'picklist' && fieldDef.options ? (
                      <select value={c.value} onChange={e => updateCriterion(i, { value: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white flex-1">
                        <option value="">-- select --</option>
                        {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={c.value} onChange={e => updateCriterion(i, { value: e.target.value })} placeholder="value" className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1" />
                    )}
                    {criteria.length > 1 && (
                      <button onClick={() => removeCriterion(i)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                );
              })}
            </div>
            {criteria.length > 1 && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Filter logic (optional)</label>
                <input type="text" value={filterLogic} onChange={e => setFilterLogic(e.target.value)} placeholder="e.g. 1 AND (2 OR 3)" className="w-64 px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
            )}
            <div className="mt-4">
              <button onClick={handlePreview} disabled={loading || validCriteria.length === 0} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Preview Matching Quotes
              </button>
            </div>
          </section>

          {/* Preview */}
          {step !== 'filters' && previewTotal !== null && (
            <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">2. Preview — {previewTotal} quote{previewTotal === 1 ? '' : 's'} matched</h3>
                {previewTotal > 20 && <span className="text-xs text-gray-400">Showing first 20</span>}
              </div>
              {previewTotal === 0 ? (
                <div className="px-5 py-8 text-sm text-gray-400 text-center">No quotes match these filters.</div>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quote</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Opp Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {previewSample.map((q, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900 font-medium">{q.quote_number || q.generated_quote_name || '--'}</td>
                          <td className="px-4 py-2 text-gray-600">{q.owner_name || '--'}</td>
                          <td className="px-4 py-2"><StageBadge value={q.stage} /></td>
                          <td className="px-4 py-2"><StatusBadge value={q.status} /></td>
                          <td className="px-4 py-2 text-gray-600">{q.priority || '--'}</td>
                          <td className="px-4 py-2 text-gray-600">{q.opportunity_type || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Changes */}
          {step !== 'filters' && previewTotal !== null && previewTotal > 0 && (
            <section className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">3. Select changes to apply</h3>
              <p className="text-xs text-gray-500 mb-4">Leave a field blank to keep it unchanged. Only the fields you fill in will be updated.</p>
              <div className="grid grid-cols-2 gap-4 max-w-2xl">
                <ChangeField label="Owner">
                  <select value={changeOwner} onChange={e => setChangeOwner(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                    <option value="">-- no change --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                  </select>
                </ChangeField>
                <ChangeField label="Priority">
                  <select value={changePriority} onChange={e => setChangePriority(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                    <option value="">-- no change --</option>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </ChangeField>
                <ChangeField label="Opportunity Type">
                  <select value={changeOppType} onChange={e => setChangeOppType(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                    <option value="">-- no change --</option>
                    {OPPORTUNITY_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </ChangeField>
                <ChangeField label="Status">
                  <select value={changeStatus} onChange={e => setChangeStatus(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                    <option value="">-- no change --</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </ChangeField>
                <ChangeField label="Stage">
                  <select value={changeStage} onChange={e => setChangeStage(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                    <option value="">-- no change --</option>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </ChangeField>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={handleExecute}
                  disabled={executing || !hasChanges}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Apply to {previewTotal} quote{previewTotal === 1 ? '' : 's'}
                </button>
                {!hasChanges && <span className="text-xs text-gray-400">Select at least one change</span>}
                {hasChanges && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    This action bypasses stage locks and cannot be undone.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function StageBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-gray-400">--</span>;
  const colors: Record<string, string> = {
    'New': 'bg-blue-50 text-blue-700',
    'In Progress': 'bg-yellow-50 text-yellow-700',
    'Completed': 'bg-green-50 text-green-700',
    'Published': 'bg-emerald-50 text-emerald-700',
    'Sent to Customer': 'bg-teal-50 text-teal-700',
    'Branch Manager Approval': 'bg-orange-50 text-orange-700',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-700'}`}>{value}</span>;
}

function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-gray-400">--</span>;
  const colors: Record<string, string> = {
    'Active': 'bg-green-100 text-green-800',
    'On Hold': 'bg-yellow-100 text-yellow-800',
    'Waiting for Information': 'bg-blue-100 text-blue-800',
    'Cancelled': 'bg-red-100 text-red-800',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-700'}`}>{value}</span>;
}

function LogView({ logs, loading }: { logs: LogEntry[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (loading) return <div className="py-12 text-center text-sm text-gray-500">Loading history...</div>;
  if (logs.length === 0) return <div className="py-12 text-center text-sm text-gray-400">No mass updates have been performed yet.</div>;

  return (
    <div className="space-y-2">
      {logs.map(log => {
        const isOpen = expanded.has(log.id);
        const changes = log.changes || {};
        return (
          <div key={log.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(log.id) ? n.delete(log.id) : n.add(log.id); return n; })} className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-gray-900">{log.affected} quote{log.affected === 1 ? '' : 's'} updated</span>
                  <span className="text-xs text-gray-500 ml-2">by {log.performed_by_name || 'Unknown'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{new Date(log.performed_at).toLocaleString()}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                  <div>
                    <span className="font-semibold text-gray-700 block mb-1">Changes applied</span>
                    <div className="space-y-0.5">
                      {Object.entries(changes).map(([k, v]) => (
                        <div key={k} className="text-gray-600"><span className="font-medium text-gray-800">{k}:</span> {v}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700 block mb-1">Filters used</span>
                    <div className="space-y-0.5">
                      {(log.filters || []).map((f, i) => (
                        <div key={i} className="text-gray-600">{f.field} {f.operator} "{f.value}"</div>
                      ))}
                      {log.filter_logic && <div className="text-gray-500 mt-1">Logic: {log.filter_logic}</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
