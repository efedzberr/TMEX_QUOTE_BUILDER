import { useEffect, useMemo, useState } from 'react';
import { Save, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { OPPORTUNITY_TYPES } from '../../lib/constants';

interface SlaTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface SlaRow {
  opportunity_type: string;
  days_high: number;
  days_standard: number;
  days_low: number;
  warning_days: number;
}

type NumericField = 'days_high' | 'days_standard' | 'days_low' | 'warning_days';

const COLUMNS: { key: NumericField; label: string; hint: string }[] = [
  { key: 'days_high', label: 'High', hint: 'Days for High priority' },
  { key: 'days_standard', label: 'Standard', hint: 'Days for Standard priority' },
  { key: 'days_low', label: 'Low', hint: 'Days for Low priority' },
  { key: 'warning_days', label: 'Warning', hint: 'Days before the due date to flag "Due soon"' },
];

export function SlaTab({ onToast }: SlaTabProps) {
  const [saved, setSaved] = useState<SlaRow[]>([]);
  const [draft, setDraft] = useState<SlaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('sla_due_date').select('*');
      if (error) throw error;
      const byType = new Map((data || []).map(r => [r.opportunity_type, r as SlaRow]));
      const rows: SlaRow[] = OPPORTUNITY_TYPES.map(t => byType.get(t) || { opportunity_type: t, days_high: 7, days_standard: 7, days_low: 7, warning_days: 1 });
      setSaved(rows);
      setDraft(rows.map(r => ({ ...r })));
    } catch (err) {
      console.error('Error loading SLA:', err);
      onToast("We couldn't load the SLA settings.", 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const invalid = useMemo(() => draft.some(r => COLUMNS.some(c => !Number.isInteger(r[c.key]) || r[c.key] < 0)), [draft]);

  function setValue(type: string, key: NumericField, raw: string) {
    const n = raw === '' ? NaN : Number(raw);
    setDraft(prev => prev.map(r => r.opportunity_type === type ? { ...r, [key]: n } : r));
  }

  async function handleSave() {
    if (!dirty || invalid) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('sla_due_date').upsert(draft, { onConflict: 'opportunity_type' });
      if (error) throw error;
      setSaved(draft.map(r => ({ ...r })));
      onToast('SLA settings saved. New calculations will use the updated days.', 'success');
    } catch (err) {
      console.error('Error saving SLA:', err);
      onToast("We couldn't save the SLA settings.", 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><Clock className="w-4 h-4 text-gray-400" /> Due Date SLA</h2>
            <p className="mt-1 text-sm text-gray-500">
              Days added to the creation date to calculate a quote's Due Date, by Opportunity Type and Priority.
              Changes apply to new quotes and to quotes whose Opportunity Type or Priority changes; existing due dates are not recalculated.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!dirty || invalid || saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Opportunity Type</th>
                  {COLUMNS.map(c => (
                    <th key={c.key} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider" title={c.hint}>
                      {c.label}
                      <div className="text-[10px] font-normal normal-case text-gray-400">{c.key === 'warning_days' ? 'days before' : 'days'}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.map(row => (
                  <tr key={row.opportunity_type} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.opportunity_type}</td>
                    {COLUMNS.map(c => {
                      const v = row[c.key];
                      const bad = !Number.isInteger(v) || v < 0;
                      return (
                        <td key={c.key} className="px-4 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={Number.isNaN(v) ? '' : v}
                            onChange={e => setValue(row.opportunity_type, c.key, e.target.value)}
                            className={`w-20 px-2 py-1.5 text-sm text-center border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${bad ? 'border-red-500' : 'border-gray-300'}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {invalid && <p className="mt-2 text-xs text-red-600">All values must be whole numbers of 0 or more.</p>}
      </section>
    </div>
  );
}
