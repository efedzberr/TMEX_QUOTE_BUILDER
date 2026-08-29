import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Settings2, Lock, MoreHorizontal, Share2, Copy, UserRound } from 'lucide-react';
import { ListView } from '../QuotesHomeHeader';
import { ConfirmModal } from '../ConfirmModal';
import { usePermissions } from '../../lib/permissions';
import { KpiTile } from './KpiTile';
import { KpiTileModal } from './KpiTileModal';
import { KpiSetsModal } from './KpiSetsModal';
import {
  KPI_MAX_TILES, KpiTile as KpiTileData, KpiTileInput, KpiSet, KpiSource,
  fetchPersonalTiles, fetchSetTiles, createTile, updateTile, deleteTile, countListViews,
  saveTileOrder, loadKpiPrefs, saveKpiPrefs, fetchKpiSets, resolveKpiSource, createKpiSet, copyTilesTo,
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
  const { can } = usePermissions();
  const canManageSets = can('module.kpi_sets');

  const [sets, setSets] = useState<KpiSet[]>([]);
  const [source, setSource] = useState<KpiSource | null>(null); // null = resolving
  const [tiles, setTiles] = useState<KpiTileData[]>([]);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [modalTile, setModalTile] = useState<KpiTileData | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<KpiTileData | null>(null);
  const [setsModalOpen, setSetsModalOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [copyConfirm, setCopyConfirm] = useState<'personal' | null>(null);
  const [nameDialog, setNameDialog] = useState<{ mode: 'share' | 'duplicate' } | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionsOpen) return;
    const onDown = (e: MouseEvent) => { if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [actionsOpen]);
  const tilesRef = useRef<KpiTileData[]>([]);
  tilesRef.current = tiles;

  const isPersonal = source === 'personal';
  const currentSet = !isPersonal && source ? sets.find(s => s.id === source) || null : null;
  const editable = isPersonal || (currentSet !== null && canManageSets);

  // Initial resolution: sets + saved choice / profile default / system default
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, prefs] = await Promise.all([fetchKpiSets(object), loadKpiPrefs(object, userId)]);
        if (cancelled) return;
        setSets(s);
        setCollapsed(prefs.kpi_collapsed);
        setSource(await resolveKpiSource(object, userId, s));
      } catch (err) {
        console.error('Error loading KPI sets:', err);
        if (!cancelled) setSource('personal');
      }
    })();
    return () => { cancelled = true; };
  }, [object, userId]);

  const loadTiles = useCallback(async () => {
    if (!userId || !source) return;
    try {
      const data = source === 'personal' ? await fetchPersonalTiles(object, userId) : await fetchSetTiles(source);
      setTiles(data);
    } catch (err) {
      console.error('Error loading KPI tiles:', err);
      onError?.("We couldn't load the KPI tiles.");
    } finally {
      setLoaded(true);
    }
  }, [object, userId, source, onError]);

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

  useEffect(() => { setLoaded(false); loadTiles(); }, [loadTiles]);
  useEffect(() => { if (loaded) recount(tiles); }, [tiles, loaded, refreshToken, recount]);

  const requestAdd = useCallback(() => {
    if (!editable) {
      onError?.('This KPI set is shared. Switch to "Personal" to add your own KPIs.');
      return;
    }
    if (tilesRef.current.length >= KPI_MAX_TILES) {
      onError?.(`You've reached the limit of ${KPI_MAX_TILES} KPIs. Delete one to add a new one.`);
      return;
    }
    setModalTile('new');
  }, [editable, onError]);
  useEffect(() => { if (addRequestId > 0) requestAdd(); }, [addRequestId, requestAdd]);

  function changeSource(next: KpiSource) {
    setSource(next);
    if (userId) saveKpiPrefs(object, userId, { kpi_source: next }).catch(err => console.error('Error saving KPI source:', err));
  }

  async function handleSave(input: KpiTileInput) {
    if (!userId || !source) return;
    if (modalTile === 'new') {
      const nextPos = tiles.length > 0 ? Math.max(...tiles.map(t => t.position)) + 1 : 0;
      await createTile(object, source === 'personal' ? { userId } : { setId: source }, input, nextPos);
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
    if (!editable || !dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
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

  async function handleCopyToPersonal() {
    if (!userId) return;
    setBusy(true);
    try {
      const { copied, skipped } = await copyTilesTo(object, tiles, { userId }, { replacePersonal: true });
      setCopyConfirm(null);
      changeSource('personal');
      onError?.(`${copied} KPI${copied === 1 ? '' : 's'} copied to your personal strip${skipped ? ` (${skipped} skipped)` : ''}.`);
    } catch (err) {
      console.error('Error copying KPIs:', err);
      onError?.("We couldn't copy the KPIs.");
      setCopyConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateFromCurrent() {
    if (!nameDialog || !userId) return;
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await createKpiSet(object, name, nameDialog.mode === 'share' ? 'Shared from a personal strip' : (currentSet ? `Copy of ${currentSet.name}` : null));
      const { copied, skipped } = await copyTilesTo(object, tiles, { setId: created.id });
      const refreshed = await fetchKpiSets(object);
      setSets(refreshed);
      setNameDialog(null); setNewName('');
      changeSource(created.id);
      onError?.(`Set "${name}" created with ${copied} KPI${copied === 1 ? '' : 's'}${skipped ? ` — ${skipped} skipped because ${skipped === 1 ? 'its view is' : 'their views are'} private` : ''}.`);
    } catch (err) {
      const msg = String((err as { message?: string } | null)?.message ?? '');
      onError?.(msg.includes('duplicate') || msg.includes('unique') ? 'A set with this name already exists.' : "We couldn't create the set.");
    } finally {
      setBusy(false);
    }
  }

  function handleSetsChanged(next: KpiSet[]) {
    setSets(next);
    if (source && source !== 'personal' && !next.some(s => s.id === source)) {
      const def = next.find(s => s.is_default);
      setSource(def ? def.id : 'personal');
    }
  }

  if (!userId || !source) return null;

  const atMax = tiles.length >= KPI_MAX_TILES;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 flex-shrink-0"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            KPIs {loaded && tiles.length > 0 && <span className="text-gray-400">({tiles.length}/{KPI_MAX_TILES})</span>}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
            <span className="hidden sm:inline">Showing</span>
            <select
              value={source}
              onChange={e => changeSource(e.target.value)}
              className="max-w-[240px] truncate px-2 py-1 text-xs border border-gray-200 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="personal">Personal</option>
              {sets.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' (default)' : ''}</option>)}
            </select>
          </label>
          {currentSet && !canManageSets && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400" title="Shared set — switch to Personal to build your own">
              <Lock className="w-3 h-3" /> shared
            </span>
          )}
        </div>
        {!collapsed && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {loaded && tiles.length > 0 && (isPersonal ? canManageSets : true) && (
              <div className="relative" ref={actionsRef}>
                <button onClick={() => setActionsOpen(o => !o)} className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-800" title="Copy / share">
                  <MoreHorizontal className="w-3.5 h-3.5" /> Actions
                </button>
                {actionsOpen && (
                  <div className="absolute right-0 top-6 z-20 w-56 bg-white border border-gray-200 rounded-md shadow-lg py-1">
                    {isPersonal && canManageSets && (
                      <button onClick={() => { setActionsOpen(false); setNewName(''); setNameDialog({ mode: 'share' }); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left">
                        <Share2 className="w-3.5 h-3.5 text-gray-400" /> Share as new set...
                      </button>
                    )}
                    {currentSet && (
                      <button onClick={() => { setActionsOpen(false); setCopyConfirm('personal'); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left">
                        <UserRound className="w-3.5 h-3.5 text-gray-400" /> Copy to Personal
                      </button>
                    )}
                    {currentSet && canManageSets && (
                      <button onClick={() => { setActionsOpen(false); setNewName(`${currentSet.name} (copy)`); setNameDialog({ mode: 'duplicate' }); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left">
                        <Copy className="w-3.5 h-3.5 text-gray-400" /> Duplicate set...
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {canManageSets && (
              <button onClick={() => setSetsModalOpen(true)} className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-800">
                <Settings2 className="w-3.5 h-3.5" /> Manage sets
              </button>
            )}
            {editable && loaded && tiles.length > 0 && (
              <button
                onClick={requestAdd}
                title={atMax ? `Limit of ${KPI_MAX_TILES} KPIs reached` : 'Add KPI'}
                className={`flex items-center gap-1 text-xs font-medium ${atMax ? 'text-gray-400 hover:text-gray-500' : 'text-blue-600 hover:text-blue-700'}`}
              >
                <Plus className="w-3.5 h-3.5" /> Add KPI
              </button>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        loaded && tiles.length === 0 ? (
          editable ? (
            <button
              onClick={requestAdd}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add KPI{currentSet ? ` to "${currentSet.name}"` : ''}
            </button>
          ) : (
            <div className="w-full py-4 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 text-center">
              This set has no KPIs yet.
            </div>
          )
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
                onDragStart={() => { if (editable) setDragId(tile.id); }}
                onDragEnter={() => { if (dragId) setOverId(tile.id); }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onDrop={() => handleDrop(tile.id)}
                readOnly={!editable}
              />
            ))}
          </div>
        )
      )}

      {modalTile !== null && (
        <KpiTileModal
          object={object}
          tile={modalTile === 'new' ? null : modalTile}
          sharedOnly={!isPersonal}
          onSave={handleSave}
          onClose={() => setModalTile(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete KPI"
          message={`Delete "${deleteTarget.title}"${currentSet ? ` from "${currentSet.name}"` : ''}? This action can't be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {copyConfirm && (
        <ConfirmModal
          title="Copy to Personal"
          message={`Replace your personal KPIs with the ${tiles.length} KPI${tiles.length === 1 ? '' : 's'} of "${currentSet?.name}"? Your current personal KPIs will be removed.`}
          onConfirm={handleCopyToPersonal}
          onCancel={() => setCopyConfirm(null)}
        />
      )}

      {nameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => !busy && setNameDialog(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">{nameDialog.mode === 'share' ? 'Share as new set' : 'Duplicate set'}</h3>
            <p className="text-xs text-gray-500 mb-4">
              {nameDialog.mode === 'share'
                ? `Your ${tiles.length} personal KPI${tiles.length === 1 ? '' : 's'} will be copied into a new shared set visible to everyone. KPIs bound to your private views are skipped.`
                : `The ${tiles.length} KPI${tiles.length === 1 ? '' : 's'} of "${currentSet?.name}" will be copied into a new set.`}
            </p>
            <label className="block text-xs font-medium text-gray-600 mb-1">Set name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} maxLength={60} autoFocus placeholder="e.g. KPIs Pricer" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" onKeyDown={e => { if (e.key === 'Enter') handleCreateFromCurrent(); }} />
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setNameDialog(null)} disabled={busy} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreateFromCurrent} disabled={busy || !newName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">{busy ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {setsModalOpen && (
        <KpiSetsModal
          object={object}
          onClose={() => setSetsModalOpen(false)}
          onChanged={handleSetsChanged}
          onError={onError}
        />
      )}
    </div>
  );
}
