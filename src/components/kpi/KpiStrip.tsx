import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { ListView } from '../QuotesHomeHeader';
import { ConfirmModal } from '../ConfirmModal';
import { KpiTile } from './KpiTile';
import { KpiTileModal } from './KpiTileModal';
import {
  KPI_MAX_TILES, KpiTile as KpiTileData, KpiTileInput,
  fetchPersonalTiles, createTile, updateTile, deleteTile, countListViews,
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

  if (!userId) return null;

  const atMax = tiles.length >= KPI_MAX_TILES;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setCollapsed(c => !c)}
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
          <div className={`flex gap-3 overflow-x-auto pb-1 ${countsLoading ? 'opacity-80' : ''}`}>
            {tiles.map(tile => (
              <KpiTile
                key={tile.id}
                tile={tile}
                count={tile.list_view_id ? counts[tile.list_view_id] : null}
                active={!!activeViewId && tile.list_view_id === activeViewId}
                onClick={() => { if (tile.list_view) onSelectView(tile.list_view); }}
                onEdit={() => setModalTile(tile)}
                onDelete={() => setDeleteTarget(tile)}
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
