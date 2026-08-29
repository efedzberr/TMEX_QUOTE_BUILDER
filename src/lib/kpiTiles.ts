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

