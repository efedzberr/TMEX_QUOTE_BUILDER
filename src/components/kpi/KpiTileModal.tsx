import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { ListView } from '../QuotesHomeHeader';
import { KPI_PALETTE } from '../../lib/kpiPalette';
import { KpiTile, KpiTileInput, fetchSelectableViews, isViewCountable } from '../../lib/kpiTiles';

interface KpiTileModalProps {
  object: string;
  /** null = create, otherwise edit */
  tile: KpiTile | null;
  onSave: (input: KpiTileInput) => Promise<void>;
  onClose: () => void;
}

export function KpiTileModal({ object, tile, onSave, onClose }: KpiTileModalProps) {
  const [title, setTitle] = useState(tile?.title ?? '');
  const [color, setColor] = useState<number>(tile?.color ?? 1);
  const [viewId, setViewId] = useState<string>(tile?.list_view_id ?? '');
  const [views, setViews] = useState<ListView[]>([]);
  const [loadingViews, setLoadingViews] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSelectableViews(object)
      .then(v => { if (!cancelled) setViews(v); })
      .catch(() => { if (!cancelled) setError("We couldn't load the list views."); })
      .finally(() => { if (!cancelled) setLoadingViews(false); });
    return () => { cancelled = true; };
  }, [object]);

  function handleViewChange(id: string) {
    setViewId(id);
    setError(null);
    if (!title.trim()) {
      const v = views.find(x => x.id === id);
      if (v) setTitle(v.name.slice(0, 40));
    }
  }

  async function handleSave() {
    const t = title.trim();
    if (!t) { setError('Title is required.'); return; }
    if (t.length > 40) { setError('Title must be 40 characters or fewer.'); return; }
    if (!viewId) { setError('Select a list view.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ title: t, color, list_view_id: viewId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg.includes('Maximum of 8') ? 'Maximum of 8 KPI tiles per strip reached.' : "We couldn't save the KPI tile.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">{tile ? 'Edit KPI' : 'Add KPI'}</h3>

        <label className="block text-xs font-medium text-gray-600 mb-1">List View</label>
        <select
          value={viewId}
          onChange={e => handleViewChange(e.target.value)}
          disabled={loadingViews}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
        >
          <option value="">{loadingViews ? 'Loading views...' : 'Select a list view'}</option>
          {views.map(v => {
            const countable = isViewCountable(v);
            return (
              <option key={v.id} value={v.id} disabled={!countable}>
                {v.name}{v.is_system ? ' (system)' : v.visibility === 'public' ? ' (public)' : ''}{countable ? '' : ' — not supported for KPI'}
              </option>
            );
          })}
        </select>

        <label className="block text-xs font-medium text-gray-600 mt-4 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setError(null); }}
          maxLength={40}
          placeholder="e.g. Overdue"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-[11px] text-gray-400 mt-1 text-right">{title.length}/40</p>

        <label className="block text-xs font-medium text-gray-600 mt-3 mb-2">Color</label>
        <div className="grid grid-cols-8 gap-2">
          {KPI_PALETTE.map(c => (
            <button
              key={c.index}
              type="button"
              title={c.name}
              onClick={() => setColor(c.index)}
              className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c.hex, borderColor: color === c.index ? '#0F2A5C' : 'transparent' }}
            >
              {color === c.index && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || loadingViews} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
