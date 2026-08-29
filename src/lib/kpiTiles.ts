import { supabase } from './supabase';
import { ListView } from '../components/QuotesHomeHeader';

export const KPI_MAX_TILES = 8;

export type KpiAlign = 'left' | 'center' | 'right';

export interface KpiSet {
  id: string;
  object: string;
  name: string;
  description: string | null;
  is_default: boolean;
}

/** 'personal' or a kpi_sets.id */
export type KpiSource = 'personal' | string;

export interface KpiTile {
  id: string;
  object: string;
  owner_user_id: string | null;
  set_id: string | null;
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
    .select(`id,object,owner_user_id,set_id,list_view_id,title,color,align,position,list_view:list_views(${LIST_VIEW_COLUMNS})`)
    .eq('object', object)
    .eq('owner_user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return mapTiles(data || []);
}

/** Tiles of a shared set, ordered by position. */
export async function fetchSetTiles(setId: string): Promise<KpiTile[]> {
  const { data, error } = await supabase
    .from('kpi_tiles')
    .select(`id,object,owner_user_id,set_id,list_view_id,title,color,align,position,list_view:list_views(${LIST_VIEW_COLUMNS})`)
    .eq('set_id', setId)
    .order('position', { ascending: true });
  if (error) throw error;
  return mapTiles(data || []);
}

function mapTiles(rows: Record<string, unknown>[]): KpiTile[] {
  return rows.map(row => {
    const lv = row.list_view as unknown;
    return { ...row, list_view: (Array.isArray(lv) ? lv[0] ?? null : lv ?? null) as ListView | null } as KpiTile;
  });
}

/** Create a tile in the user's personal strip (userId) or in a shared set (setId). */
export async function createTile(object: string, target: { userId?: string; setId?: string }, input: KpiTileInput, position: number): Promise<void> {
  const { error } = await supabase.from('kpi_tiles').insert({
    object,
    owner_user_id: target.setId ? null : target.userId,
    set_id: target.setId || null,
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
  /** 'personal' | set id | null (not chosen yet) */
  kpi_source: KpiSource | null;
}

/** Read KPI-related keys from user_list_view_preferences.display_prefs. */
export async function loadKpiPrefs(object: string, userId: string): Promise<KpiDisplayPrefs> {
  const { data } = await supabase
    .from('user_list_view_preferences')
    .select('display_prefs')
    .eq('user_id', userId).eq('object', object)
    .maybeSingle();
  const dp = (data?.display_prefs as Record<string, unknown>) || {};
  return { kpi_collapsed: dp.kpi_collapsed === true, kpi_source: typeof dp.kpi_source === 'string' ? dp.kpi_source : null };
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

/** Views the current user can see for the object (RLS-filtered), sorted by name.
 *  sharedOnly = true keeps only system and public views (required for shared KPI sets). */
export async function fetchSelectableViews(object: string, sharedOnly = false): Promise<ListView[]> {
  const { data, error } = await supabase
    .from('list_views')
    .select(LIST_VIEW_COLUMNS)
    .eq('object', object)
    .order('name', { ascending: true });
  if (error) throw error;
  const views = (data || []) as ListView[];
  return sharedOnly ? views.filter(v => v.is_system || v.visibility === 'public') : views;
}

// ---------------------------------------------------------------- KPI sets

export async function fetchKpiSets(object: string): Promise<KpiSet[]> {
  const { data, error } = await supabase
    .from('kpi_sets')
    .select('id,object,name,description,is_default')
    .eq('object', object)
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data || []) as KpiSet[];
}

export async function createKpiSet(object: string, name: string, description: string | null): Promise<KpiSet> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('kpi_sets')
    .insert({ object, name: name.trim(), description, created_by: user?.id || null })
    .select('id,object,name,description,is_default')
    .single();
  if (error) throw error;
  return data as KpiSet;
}

export async function updateKpiSet(id: string, patch: { name?: string; description?: string | null; is_default?: boolean }): Promise<void> {
  const { error } = await supabase.from('kpi_sets').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteKpiSet(id: string): Promise<void> {
  const { error } = await supabase.from('kpi_sets').delete().eq('id', id);
  if (error) throw error;
}

export interface ProfileKpiDefault {
  id: string;
  name: string;
  is_system: boolean;
  default_kpi_set_id: string | null;
}

export async function fetchProfilesKpiDefaults(): Promise<ProfileKpiDefault[]> {
  const { data, error } = await supabase.from('profiles').select('id,name,is_system,default_kpi_set_id').order('is_system', { ascending: false }).order('name');
  if (error) throw error;
  return (data || []) as ProfileKpiDefault[];
}

export async function setProfileKpiDefault(profileId: string, setId: string | null): Promise<void> {
  const { error } = await supabase.from('profiles').update({ default_kpi_set_id: setId }).eq('id', profileId);
  if (error) throw error;
}

/** Which strip to show: saved choice -> profile default -> system default -> 'personal'. */
export async function resolveKpiSource(object: string, userId: string, sets: KpiSet[]): Promise<KpiSource> {
  const prefs = await loadKpiPrefs(object, userId);
  if (prefs.kpi_source === 'personal') return 'personal';
  if (prefs.kpi_source && sets.some(s => s.id === prefs.kpi_source)) return prefs.kpi_source;
  const { data: me } = await supabase.from('user_profiles').select('profile_id').eq('id', userId).maybeSingle();
  if (me?.profile_id) {
    const { data: prof } = await supabase.from('profiles').select('default_kpi_set_id').eq('id', me.profile_id).maybeSingle();
    if (prof?.default_kpi_set_id && sets.some(s => s.id === prof.default_kpi_set_id)) return prof.default_kpi_set_id;
  }
  const def = sets.find(s => s.is_default);
  return def ? def.id : 'personal';
}

/** A view is countable server-side unless it filters on a client-computed field. */
export function isViewCountable(view: ListView): boolean {
  const filters = view.filters || [];
  return !filters.some(f => f.field === 'customer_review_status');
}
