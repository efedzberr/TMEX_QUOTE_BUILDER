Two adjustments to the KPI Tiles strip on the Quotes page: (1) all 8 tiles must fit in one row with no horizontal scrollbar — tiles share the available width equally and the number is slightly smaller; (2) each tile has a text alignment (left / center / right) chosen in the Add/Edit KPI modal and stored in the new `kpi_tiles.align` column (migration already applied).

Do NOT create migrations. Do NOT modify any file other than the 4 listed below. Do NOT touch `QuoteListView.tsx` or `kpiPalette.ts`. Do NOT add npm dependencies.

IMPORTANT for `src/lib/kpiTiles.ts`: every symbol is already exported inline with the `export` keyword. Do NOT append an `export { ... }` statement at the end of the file — that causes "Multiple exports with the same name" build errors. The file must end with the closing `}` of `isViewCountable`.

Replace the FULL contents of each of the following 4 files with the exact contents given.

## 1. `src/lib/kpiTiles.ts` (replace entire file)

```ts
import { supabase } from './supabase';
import { ListView } from '../components/QuotesHomeHeader';

export const KPI_MAX_TILES = 8;

export type KpiAlign = 'left' | 'center' | 'right';

export interface KpiTile {
  id: string;
  object: string;
  owner_user_id: string | null;
  list_view_id: string | null;
  title: string;
  color: number;
  align: KpiAlign;
  position: number;
  /** Joined list view; null when the view was deleted or is not visible. */
  list_view: ListView | null;
}

export interface KpiTileInput {
  title: string;
  color: number;
  align: KpiAlign;
  list_view_id: string;
}

const LIST_VIEW_COLUMNS = 'id,name,object,owner_user_id,visibility,is_system,filters,filter_logic,columns,sorting';

/** Personal tiles for the current user and object, ordered by position. */
export async function fetchPersonalTiles(object: string, userId: string): Promise<KpiTile[]> {
  const { data, error } = await supabase
    .from('kpi_tiles')
    .select(`id,object,owner_user_id,list_view_id,title,color,align,position,list_view:list_views(${LIST_VIEW_COLUMNS})`)
    .eq('object', object)
    .eq('owner_user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data || []).map(row => {
    const lv = row.list_view as unknown;
    return {
      ...row,
      list_view: (Array.isArray(lv) ? lv[0] ?? null : lv ?? null) as ListView | null,
    } as KpiTile;
  });
}

export async function createTile(object: string, userId: string, input: KpiTileInput, position: number): Promise<void> {
  const { error } = await supabase.from('kpi_tiles').insert({
    object,
    owner_user_id: userId,
    list_view_id: input.list_view_id,
    title: input.title.trim(),
    color: input.color,
    align: input.align,
    position,
  });
  if (error) throw error;
}

export async function updateTile(id: string, input: KpiTileInput): Promise<void> {
  const { error } = await supabase.from('kpi_tiles').update({
    list_view_id: input.list_view_id,
    title: input.title.trim(),
    color: input.color,
    align: input.align,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteTile(id: string): Promise<void> {
  const { error } = await supabase.from('kpi_tiles').delete().eq('id', id);
  if (error) throw error;
}

/** Persist a new order: position = index in ids. */
export async function saveTileOrder(ids: string[]): Promise<void> {
  const results = await Promise.all(
    ids.map((id, index) => supabase.from('kpi_tiles').update({ position: index }).eq('id', id))
  );
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
}

export interface KpiDisplayPrefs {
  kpi_collapsed: boolean;
}

/** Read KPI-related keys from user_list_view_preferences.display_prefs. */
export async function loadKpiPrefs(object: string, userId: string): Promise<KpiDisplayPrefs> {
  const { data } = await supabase
    .from('user_list_view_preferences')
    .select('display_prefs')
    .eq('user_id', userId).eq('object', object)
    .maybeSingle();
  const dp = (data?.display_prefs as Record<string, unknown>) || {};
  return { kpi_collapsed: dp.kpi_collapsed === true };
}

/** Merge KPI keys into display_prefs without touching other keys (column widths, etc.). */
export async function saveKpiPrefs(object: string, userId: string, prefs: Partial<KpiDisplayPrefs>): Promise<void> {
  const { data: existing } = await supabase
    .from('user_list_view_preferences')
    .select('display_prefs, pinned_list_view_id, recent_list_view_ids')
    .eq('user_id', userId).eq('object', object)
    .maybeSingle();
  const dp = (existing?.display_prefs as Record<string, unknown>) || {};
  const { error } = await supabase.from('user_list_view_preferences').upsert({
    user_id: userId,
    object,
    pinned_list_view_id: existing?.pinned_list_view_id || null,
    recent_list_view_ids: existing?.recent_list_view_ids || [],
    display_prefs: { ...dp, ...prefs },
  }, { onConflict: 'user_id,object' });
  if (error) throw error;
}

/** Server-side counts. Returns a map view_id -> count (null when the view cannot be counted). */
export async function countListViews(viewIds: string[]): Promise<Record<string, number | null>> {
  const unique = Array.from(new Set(viewIds.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.rpc('count_list_views', { p_view_ids: unique });
  if (error) throw error;
  const result: Record<string, number | null> = {};
  for (const id of unique) result[id] = null;
  for (const row of (data || []) as { view_id: string; record_count: number | null }[]) {
    result[row.view_id] = row.record_count == null ? null : Number(row.record_count);
  }
  return result;
}

/** Views the current user can see for the object (RLS-filtered), sorted by name. */
export async function fetchSelectableViews(object: string): Promise<ListView[]> {
  const { data, error } = await supabase
    .from('list_views')
    .select(LIST_VIEW_COLUMNS)
    .eq('object', object)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as ListView[];
}

/** A view is countable server-side unless it filters on a client-computed field. */
export function isViewCountable(view: ListView): boolean {
  const filters = view.filters || [];
  return !filters.some(f => f.field === 'customer_review_status');
}
```

## 2. `src/components/kpi/KpiTile.tsx` (replace entire file)

```tsx
import { useEffect, useRef, useState } from 'react';
import { GripVertical, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { KpiTile as KpiTileData } from '../../lib/kpiTiles';
import { kpiColorHex, kpiColorTint } from '../../lib/kpiPalette';

interface KpiTileProps {
  tile: KpiTileData;
  count: number | null | undefined; // undefined = loading
  active: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  // drag & drop (native HTML5)
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

export function KpiTile({
  tile, count, active, onClick, onEdit, onDelete,
  dragging, dropTarget, onDragStart, onDragEnter, onDragEnd, onDrop,
}: KpiTileProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const unavailable = !tile.list_view;
  const hex = unavailable ? '#9CA3AF' : kpiColorHex(tile.color);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const display = unavailable || count === null ? '\u2014' : count === undefined ? '' : count.toLocaleString('en-US');

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tile.id); onDragStart(); }}
      onDragEnter={e => { e.preventDefault(); onDragEnter(); }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={e => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
      className={`group relative flex-1 min-w-0 rounded-lg border-2 bg-white transition-all ${unavailable ? 'cursor-default' : 'cursor-pointer hover:shadow-md'} ${dragging ? 'opacity-40' : ''} ${dropTarget && !dragging ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
      style={{
        borderColor: active ? hex : kpiColorTint(hex, 0.45),
        backgroundColor: active ? kpiColorTint(hex, 0.08) : '#FFFFFF',
      }}
      onClick={() => { if (!unavailable) onClick(); }}
      title={unavailable ? 'View not available' : tile.list_view?.name}
    >
      <div className="px-3 pt-2 pb-2" style={{ textAlign: tile.align || 'left' }}>
        <div className="flex items-start gap-1">
          <GripVertical className="w-3 h-3 -ml-1.5 mt-0.5 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
          <p className={`flex-1 min-w-0 text-[11px] font-semibold uppercase tracking-wide truncate ${unavailable ? 'text-gray-400' : 'text-[#0F2A5C]'}`}>{tile.title}</p>
          <div className="relative -mr-1.5 -mt-1" ref={menuRef}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className={`p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              title="Options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-20 w-36 bg-white border border-gray-200 rounded-md shadow-lg py-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setMenuOpen(false); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left">
                  <Pencil className="w-3.5 h-3.5 text-gray-400" /> Edit
                </button>
                <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 text-left">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums" style={{ color: hex }}>
          {display || <span className="inline-block w-8 h-6 bg-gray-100 rounded animate-pulse" />}
        </p>
        {unavailable && <p className="mt-1 text-[10px] text-gray-400 italic">View not available</p>}
      </div>
    </div>
  );
}
```

## 3. `src/components/kpi/KpiTileModal.tsx` (replace entire file)

```tsx
import { useEffect, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Check } from 'lucide-react';
import { ListView } from '../QuotesHomeHeader';
import { KPI_PALETTE } from '../../lib/kpiPalette';
import { KpiAlign, KpiTile, KpiTileInput, fetchSelectableViews, isViewCountable } from '../../lib/kpiTiles';

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
  const [align, setAlign] = useState<KpiAlign>(tile?.align ?? 'left');
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
      await onSave({ title: t, color, align, list_view_id: viewId });
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

        <label className="block text-xs font-medium text-gray-600 mt-4 mb-2">Alignment</label>
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
          {([
            { value: 'left', Icon: AlignLeft, label: 'Left' },
            { value: 'center', Icon: AlignCenter, label: 'Center' },
            { value: 'right', Icon: AlignRight, label: 'Right' },
          ] as { value: KpiAlign; Icon: typeof AlignLeft; label: string }[]).map(({ value, Icon, label }) => (
            <button
              key={value}
              type="button"
              title={label}
              onClick={() => setAlign(value)}
              className={`px-3 py-1.5 text-xs flex items-center gap-1 border-r last:border-r-0 border-gray-200 transition-colors ${align === value ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
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
```

## 4. `src/components/kpi/KpiStrip.tsx` (replace entire file)

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { ListView } from '../QuotesHomeHeader';
import { ConfirmModal } from '../ConfirmModal';
import { KpiTile } from './KpiTile';
import { KpiTileModal } from './KpiTileModal';
import {
  KPI_MAX_TILES, KpiTile as KpiTileData, KpiTileInput,
  fetchPersonalTiles, createTile, updateTile, deleteTile, countListViews,
  saveTileOrder, loadKpiPrefs, saveKpiPrefs,
} from '../../lib/kpiTiles';

interface KpiStripProps {
  object: string;
  userId: string | null;
  /** id of the list's active view, used to highlight the matching tile */
  activeViewId: string | null | undefined;
  onSelectView: (view: ListView) => void;
  /** change this value to force a recount (e.g. list refresh) */
  refreshToken: unknown;
  /** increment to open the Add KPI modal from outside (toolbar button) */
  addRequestId: number;
  onError?: (message: string) => void;
}

export function KpiStrip({ object, userId, activeViewId, onSelectView, refreshToken, addRequestId, onError }: KpiStripProps) {
  const [tiles, setTiles] = useState<KpiTileData[]>([]);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [modalTile, setModalTile] = useState<KpiTileData | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<KpiTileData | null>(null);

  const loadTiles = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchPersonalTiles(object, userId);
      setTiles(data);
    } catch (err) {
      console.error('Error loading KPI tiles:', err);
      onError?.("We couldn't load the KPI tiles.");
    } finally {
      setLoaded(true);
    }
  }, [object, userId, onError]);

  const recount = useCallback(async (list: KpiTileData[]) => {
    const ids = list.map(t => t.list_view_id).filter((id): id is string => !!id);
    if (ids.length === 0) { setCounts({}); return; }
    setCountsLoading(true);
    try {
      setCounts(await countListViews(ids));
    } catch (err) {
      console.error('Error counting KPI tiles:', err);
      const empty: Record<string, number | null> = {};
      for (const id of ids) empty[id] = null;
      setCounts(empty);
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => { loadTiles(); }, [loadTiles]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadKpiPrefs(object, userId).then(p => { if (!cancelled) setCollapsed(p.kpi_collapsed); }).catch(() => {});
    return () => { cancelled = true; };
  }, [object, userId]);
  useEffect(() => { if (loaded) recount(tiles); }, [tiles, loaded, refreshToken, recount]);
  useEffect(() => { if (addRequestId > 0) setModalTile('new'); }, [addRequestId]);

  async function handleSave(input: KpiTileInput) {
    if (!userId) return;
    if (modalTile === 'new') {
      const nextPos = tiles.length > 0 ? Math.max(...tiles.map(t => t.position)) + 1 : 0;
      await createTile(object, userId, input, nextPos);
    } else if (modalTile) {
      await updateTile(modalTile.id, input);
    }
    setModalTile(null);
    await loadTiles();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTile(deleteTarget.id);
      setDeleteTarget(null);
      await loadTiles();
    } catch (err) {
      console.error('Error deleting KPI tile:', err);
      onError?.("We couldn't delete the KPI tile.");
      setDeleteTarget(null);
    }
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (userId) saveKpiPrefs(object, userId, { kpi_collapsed: next }).catch(err => console.error('Error saving KPI prefs:', err));
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const from = tiles.findIndex(t => t.id === dragId);
    const to = tiles.findIndex(t => t.id === targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    const reordered = [...tiles];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const withPositions = reordered.map((t, i) => ({ ...t, position: i }));
    setTiles(withPositions);
    setDragId(null);
    setOverId(null);
    saveTileOrder(withPositions.map(t => t.id)).catch(err => {
      console.error('Error saving KPI order:', err);
      onError?.("We couldn't save the KPI order.");
      loadTiles();
    });
  }

  if (!userId) return null;

  const atMax = tiles.length >= KPI_MAX_TILES;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          KPIs {loaded && tiles.length > 0 && <span className="text-gray-400">({tiles.length}/{KPI_MAX_TILES})</span>}
        </button>
        {!collapsed && loaded && tiles.length > 0 && (
          <button
            onClick={() => setModalTile('new')}
            disabled={atMax}
            title={atMax ? `Maximum of ${KPI_MAX_TILES} KPIs` : 'Add KPI'}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Add KPI
          </button>
        )}
      </div>

      {!collapsed && (
        loaded && tiles.length === 0 ? (
          <button
            onClick={() => setModalTile('new')}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add KPI
          </button>
        ) : (
          <div className={`flex gap-2.5 ${countsLoading ? 'opacity-80' : ''}`}>
            {tiles.map(tile => (
              <KpiTile
                key={tile.id}
                tile={tile}
                count={tile.list_view_id ? counts[tile.list_view_id] : null}
                active={!!activeViewId && tile.list_view_id === activeViewId}
                onClick={() => { if (tile.list_view) onSelectView(tile.list_view); }}
                onEdit={() => setModalTile(tile)}
                onDelete={() => setDeleteTarget(tile)}
                dragging={dragId === tile.id}
                dropTarget={overId === tile.id}
                onDragStart={() => setDragId(tile.id)}
                onDragEnter={() => { if (dragId) setOverId(tile.id); }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onDrop={() => handleDrop(tile.id)}
              />
            ))}
          </div>
        )
      )}

      {modalTile !== null && (
        <KpiTileModal
          object={object}
          tile={modalTile === 'new' ? null : modalTile}
          onSave={handleSave}
          onClose={() => setModalTile(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete KPI"
          message={`Delete "${deleteTarget.title}"? This action can't be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
```

## Verify

1. Confirm the 4 files match exactly and that `kpiTiles.ts` has NO trailing `export { ... }` block.
2. Confirm `QuoteListView.tsx` was NOT modified.
3. Run `npm run build` and confirm it succeeds. Do not fix unrelated pre-existing TypeScript warnings in other files.
