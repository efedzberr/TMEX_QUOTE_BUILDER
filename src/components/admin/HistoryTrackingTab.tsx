import { useEffect, useMemo, useState } from 'react';
import { History, Save, X, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/permissions';
import type { HistoryTrackingObject, ObjectFieldDef } from '../../lib/adminObjectCatalog';

const MAX_TRACKED = 40;

interface HistoryTrackingTabProps {
  object: HistoryTrackingObject;
  fields: ObjectFieldDef[];
  onToast?: (message: string) => void;
}

export function HistoryTrackingTab({ object, fields, onToast }: HistoryTrackingTabProps) {
  const { can } = usePermissions();
  const canEdit = can('quote.field_history_config', 'edit');

  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackable = useMemo(() => fields.filter(f => f.trackable !== false), [fields]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .from('field_history_tracking')
      .select('column_name')
      .eq('object', object)
      .eq('enabled', true)
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) { setError(e.message); setLoading(false); return; }
        const s = new Set<string>((data || []).map(r => r.column_name as string));
        setSaved(s);
        setDraft(new Set(s));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [object]);

  const dirty = useMemo(() => {
    if (saved.size !== draft.size) return true;
    for (const c of saved) if (!draft.has(c)) return true;
    return false;
  }, [saved, draft]);

  const toggle = (column: string) => {
    if (!canEdit) return;
    setDraft(prev => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else if (next.size < MAX_TRACKED) next.add(column);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { error: e } = await supabase.rpc('set_field_history_tracking', {
      p_object: object,
      p_columns: Array.from(draft),
    });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setSaved(new Set(draft));
    onToast?.('History tracking updated');
  };

  const handleCancel = () => setDraft(new Set(saved));

  const atLimit = draft.size >= MAX_TRACKED;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Set History Tracking</h3>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Select the fields to track. Every change to a tracked field records the old value, the new value, who changed it and when.
            {' '}Up to {MAX_TRACKED} fields per object.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${atLimit ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
            {draft.size} / {MAX_TRACKED} tracked
          </span>
          {canEdit && (
            <>
              <button
                onClick={handleCancel}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving\u2026' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="mb-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          <Lock className="w-3.5 h-3.5" /> You can view this configuration but not change it (requires "Quote Field History" edit permission).
        </div>
      )}

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-12 px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Track</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Field Label</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Column</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400">Loading\u2026</td></tr>
            ) : fields.map(f => {
              const isTrackable = f.trackable !== false;
              const checked = draft.has(f.column);
              const disabled = !canEdit || !isTrackable || (!checked && atLimit);
              return (
                <tr
                  key={f.column}
                  onClick={() => { if (!disabled) toggle(f.column); }}
                  className={`border-b border-gray-100 last:border-b-0 ${isTrackable ? 'hover:bg-gray-50' : 'bg-gray-50/60 text-gray-400'} ${disabled ? '' : 'cursor-pointer'}`}
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(f.column)}
                      onClick={e => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                    />
                  </td>
                  <td className={`px-4 py-2.5 ${isTrackable ? 'text-gray-900' : ''}`}>{f.label}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{f.column}</td>
                  <td className="px-4 py-2.5"><span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-50 border border-gray-200 text-gray-600">{f.type}</span></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {isTrackable ? (f.notes || '') : 'Not trackable \u2014 derived from the clock, no stored value'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400">{trackable.length} trackable field{trackable.length === 1 ? '' : 's'}.</p>
    </div>
  );
}
