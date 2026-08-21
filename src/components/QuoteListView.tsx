import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Trash2, Pencil, Copy, Lock, GitBranch, Settings, ArrowUp, ArrowDown,
  Columns3, RotateCcw as ResetIcon, Filter, Search, X, FilePlus, Share2,
  RefreshCw, MoreVertical, Eye, AlertCircle,
} from 'lucide-react';
import { supabase, Quote, QuoteLane } from '../lib/supabase';
import { isQuoteLocked } from '../lib/constants';
import { calculateQuoteReviewStatus } from '../lib/customerPortalHelpers';
import { QuotesHomeHeader, ListView, ListViewFilter, ListViewColumn, ListViewSort } from './QuotesHomeHeader';
import { SelectFieldsModal } from './SelectFieldsModal';
import { FilterPanel } from './FilterPanel';
import { ListViewModals, ViewModalType } from './ListViewModals';
import { FIELD_CATALOG_MAP, isLinkField } from '../lib/quoteFieldCatalog';
import { FilterCriterion, OwnerScope, applyComposedFilters } from '../lib/quoteFilterEngine';

interface QuoteListViewProps {
  onCreateNew: () => void;
  onSelectQuote: (quoteId: string) => void;
  onDeleteQuote: (quoteId: string) => void;
  onCloneQuote: (quote: Quote) => void;
}

const STAGE_COLORS: Record<string, string> = {
  'New': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'Branch Manager Approval': 'bg-orange-100 text-orange-800',
  'Sent to Customer': 'bg-teal-100 text-teal-800',
  'Published': 'bg-gray-100 text-gray-800',
};

const SYSTEM_VIEW_ALL = 'a0000000-0000-0000-0000-000000000001';
const SYSTEM_VIEW_RECENT = 'a0000000-0000-0000-0000-000000000003';
const PAGE_SIZE = 50;
const SELECTION_CAP = 200;

export function QuoteListView({ onCreateNew, onSelectQuote, onDeleteQuote, onCloneQuote }: QuoteListViewProps) {
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [quoteLanes, setQuoteLanes] = useState<Record<string, QuoteLane[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [cloningId, setCloningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ListView | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Session overrides
  const [sessionColumns, setSessionColumns] = useState<ListViewColumn[] | null>(null);
  const [sessionSorting, setSessionSorting] = useState<ListViewSort[] | null>(null);
  const [readOnlyNotice, setReadOnlyNotice] = useState(false);

  // Gear menu
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);

  // Modals
  const [selectFieldsOpen, setSelectFieldsOpen] = useState(false);
  const [viewModalType, setViewModalType] = useState<ViewModalType>(null);

  // Column widths
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ field: string; startX: number; startW: number } | null>(null);

  // Filter state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activeCriteria, setActiveCriteria] = useState<FilterCriterion[]>([]);
  const [activeFilterLogic, setActiveFilterLogic] = useState('');
  const [activeOwnerScope, setActiveOwnerScope] = useState<OwnerScope>('all');
  const [sessionFilters, setSessionFilters] = useState<{ criteria: FilterCriterion[]; filterLogic: string; ownerScope: OwnerScope } | null>(null);
  const [ownerProfiles, setOwnerProfiles] = useState<{ id: string; display_name: string }[]>([]);

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionCapHit, setSelectionCapHit] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Row action menu
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [rowMenuPos, setRowMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  // Ticking timestamp
  const [, setTick] = useState(0);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Refs for stable callbacks
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const initializedRef = useRef(false);

  // ---------- Effects ----------

  useEffect(() => { initializeView(); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Tick the timestamp every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Close gear on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false);
    }
    if (gearOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gearOpen]);

  // Close row menu on outside click / Escape
  useEffect(() => {
    if (!rowMenuId) return;
    function handleClick(e: MouseEvent) {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) setRowMenuId(null);
    }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') setRowMenuId(null); }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [rowMenuId]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchTerm]);

  // Reset selection when view/filters/search change
  useEffect(() => { clearSelection(); }, [activeView?.id, debouncedSearch, activeCriteria, activeOwnerScope, sessionFilters]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
        loadNextPage();
      }
    }, { rootMargin: '200px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, allQuotes.length]);

  // ---------- Helpers ----------

  function canEditView(view: ListView | null): boolean {
    if (!view || view.is_system) return false;
    if (view.owner_user_id === userId) return true;
    if (view.visibility === 'public' && isAdmin) return true;
    return false;
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectionCapHit(false);
  }

  // ---------- Initialization ----------

  async function initializeView() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id || null;
      setUserId(uid);

      if (uid) {
        const [profileRes, profsRes] = await Promise.all([
          supabase.from('user_profiles').select('is_admin').eq('id', uid).maybeSingle(),
          supabase.from('user_profiles').select('id, display_name').order('display_name'),
        ]);
        if (profileRes.data?.is_admin) setIsAdmin(true);
        if (profsRes.data) setOwnerProfiles(profsRes.data.map(p => ({ id: p.id, display_name: p.display_name || '' })));
      }

      let pinnedViewId: string | null = null;
      if (uid) {
        const { data: prefs } = await supabase
          .from('user_list_view_preferences')
          .select('pinned_list_view_id, display_prefs')
          .eq('user_id', uid).eq('object', 'quote').maybeSingle();
        if (prefs?.pinned_list_view_id) pinnedViewId = prefs.pinned_list_view_id;
        if (prefs?.display_prefs) {
          const dp = prefs.display_prefs as Record<string, Record<string, number>>;
          const viewId = pinnedViewId || SYSTEM_VIEW_RECENT;
          if (dp[viewId]) setColWidths(dp[viewId]);
        }
      }

      const defaultViewId = pinnedViewId || SYSTEM_VIEW_RECENT;
      const { data: viewData } = await supabase.from('list_views').select('*').eq('id', defaultViewId).maybeSingle();
      const view = viewData as ListView | null;
      if (view) {
        setActiveView(view);
        applyViewFilters(view);
        await loadQuotesForView(view, uid);
      } else {
        const { data: fallback } = await supabase.from('list_views').select('*').eq('id', SYSTEM_VIEW_ALL).maybeSingle();
        const fb = fallback as ListView | null;
        setActiveView(fb);
        if (fb) applyViewFilters(fb);
        await loadQuotesForView(fb, uid);
      }
      initializedRef.current = true;
    } catch (err) {
      console.error('Error initializing:', err);
      setErrorState("We couldn't load the Quotes.");
      setLoading(false);
    }
  }

  function applyViewFilters(view: ListView) {
    const filters = view.filters || [];
    const userCriteria: FilterCriterion[] = [];
    let ownerScope: OwnerScope = 'all';
    for (const f of filters) {
      if (f.special === 'recently_viewed') continue;
      if (f.field === 'owner_user_id' && f.operator === 'equals' && f.value === '$CURRENT_USER') { ownerScope = 'mine'; continue; }
      if (f.field && f.operator) userCriteria.push({ id: crypto.randomUUID(), field: f.field, operator: f.operator, value: f.value || '' });
    }
    setActiveCriteria(userCriteria);
    setActiveFilterLogic(view.filter_logic || '');
    setActiveOwnerScope(ownerScope);
    setSessionFilters(null);
  }

  // ---------- Data loading ----------

  function isRecentlyViewedFilter(filters: ListViewFilter[]): boolean {
    return filters?.some(f => f.special === 'recently_viewed') || false;
  }

  const loadQuotesForView = useCallback(async (view: ListView | null, uid: string | null, sortOverride?: ListViewSort[], isRefresh?: boolean) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErrorState(null);
    try {
      const sorting = sortOverride || view?.sorting;
      let data: Quote[] | null = null;
      let count = 0;

      if (view && isRecentlyViewedFilter(view.filters)) {
        data = await fetchRecentlyViewed(uid);
        count = data?.length || 0;
      } else {
        const result = await fetchQuotesPage(sorting, 0, PAGE_SIZE);
        data = result.data;
        count = result.count;
      }

      if (data) {
        setAllQuotes(data);
        setTotalCount(count);
        setHasMore(data.length < count);
        await loadLanesForQuotes(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error loading quotes:', err);
      setErrorState("We couldn't load the Quotes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function loadNextPage() {
    if (loadingMore || !hasMore) return;
    const view = activeViewRef.current;
    if (view && isRecentlyViewedFilter(view.filters)) return;
    setLoadingMore(true);
    try {
      const sorting = view?.sorting;
      const result = await fetchQuotesPage(sorting, allQuotes.length, PAGE_SIZE);
      if (result.data && result.data.length > 0) {
        const existingIds = new Set(allQuotes.map(q => q.id));
        const newQuotes = result.data.filter(q => !existingIds.has(q.id));
        const merged = [...allQuotes, ...newQuotes];
        setAllQuotes(merged);
        setHasMore(merged.length < result.count);
        setTotalCount(result.count);
        await loadLanesForQuotes(newQuotes);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function fetchRecentlyViewed(uid: string | null): Promise<Quote[]> {
    if (!uid) return [];
    const { data: recentData } = await supabase
      .from('recent_record_views').select('record_id')
      .eq('user_id', uid).eq('object', 'quote')
      .order('viewed_at', { ascending: false }).limit(50);
    if (!recentData || recentData.length === 0) return [];
    const ids = recentData.map(r => r.record_id);
    const { data } = await supabase.from('quotes').select('*').in('id', ids);
    if (!data) return [];
    const orderMap = new Map(ids.map((id, i) => [id, i]));
    return data.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
  }

  async function fetchQuotesPage(sorting?: ListViewSort[], offset = 0, limit = PAGE_SIZE): Promise<{ data: Quote[]; count: number }> {
    let query = supabase.from('quotes').select('*', { count: 'exact' });
    if (sorting && sorting.length > 0) {
      query = query.order(sorting[0].field, { ascending: sorting[0].direction === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    query = query.range(offset, offset + limit - 1);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  async function loadLanesForQuotes(quotes: Quote[]) {
    if (quotes.length === 0) return;
    try {
      const quoteIds = quotes.map(q => q.id);
      const { data, error } = await supabase.from('quote_lanes').select('*').in('quote_id', quoteIds);
      if (error) throw error;
      if (data) {
        setQuoteLanes(prev => {
          const updated = { ...prev };
          data.forEach(lane => {
            if (!updated[lane.quote_id]) updated[lane.quote_id] = [];
            else if (!prev[lane.quote_id]) updated[lane.quote_id] = [];
            updated[lane.quote_id] = [...(updated[lane.quote_id] || []).filter(l => l.id !== lane.id), lane];
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error loading lanes:', error);
    }
  }

  // ---------- Refresh ----------

  async function handleRefresh() {
    if (refreshing) return;
    await loadQuotesForView(activeView, userId, undefined, true);
  }

  // ---------- Filtering ----------

  const effectiveCriteria = sessionFilters?.criteria ?? activeCriteria;
  const effectiveFilterLogic = sessionFilters?.filterLogic ?? activeFilterLogic;
  const effectiveOwnerScope = sessionFilters?.ownerScope ?? activeOwnerScope;

  function calculateTotalAmount(quoteId: string): number {
    const lanes = quoteLanes[quoteId] || [];
    return lanes.reduce((sum, lane) => sum + (lane.us_rate + lane.mx_rate + lane.border_crossing_fee + (lane.toll_rate || 0)), 0);
  }

  const filteredQuotes = useMemo(() => {
    return applyComposedFilters({
      records: allQuotes as unknown[] as Record<string, unknown>[],
      ownerScope: effectiveOwnerScope,
      userId,
      criteria: effectiveCriteria,
      filterLogic: effectiveFilterLogic,
      searchTerm: debouncedSearch,
      computeTotalAmount: calculateTotalAmount,
    }) as unknown[] as Quote[];
  }, [allQuotes, effectiveOwnerScope, userId, effectiveCriteria, effectiveFilterLogic, debouncedSearch, quoteLanes]);

  const displayCount = (effectiveCriteria.length > 0 || effectiveOwnerScope === 'mine' || debouncedSearch) ? filteredQuotes.length : totalCount;

  // ---------- Columns / Sorting ----------

  const effectiveColumns: ListViewColumn[] = sessionColumns || activeView?.columns || [];
  const effectiveSorting: ListViewSort[] = sessionSorting || activeView?.sorting || [];

  async function handleColumnsChange(newCols: ListViewColumn[]) {
    if (!activeView) return;
    if (canEditView(activeView)) {
      const updated = { ...activeView, columns: newCols };
      setActiveView(updated);
      setSessionColumns(null);
      setReadOnlyNotice(false);
      await supabase.from('list_views').update({ columns: newCols, updated_at: new Date().toISOString() }).eq('id', activeView.id);
    } else {
      setSessionColumns(newCols);
      setReadOnlyNotice(true);
    }
  }

  async function handleSort(field: string) {
    const fieldDef = FIELD_CATALOG_MAP.get(field);
    if (!fieldDef?.sortable) return;
    let newSorting: ListViewSort[];
    const current = effectiveSorting[0];
    if (current?.field === field) {
      newSorting = [{ field, direction: current.direction === 'asc' ? 'desc' : 'asc' }];
    } else {
      newSorting = [{ field, direction: 'asc' }];
    }
    if (canEditView(activeView)) {
      const updated = { ...activeView!, sorting: newSorting };
      setActiveView(updated);
      setSessionSorting(null);
      setReadOnlyNotice(false);
      await supabase.from('list_views').update({ sorting: newSorting, updated_at: new Date().toISOString() }).eq('id', activeView!.id);
      await loadQuotesForView(updated, userId, newSorting);
    } else {
      setSessionSorting(newSorting);
      setReadOnlyNotice(true);
      await loadQuotesForView(activeView, userId, newSorting);
    }
  }

  async function resetSorting() {
    setGearOpen(false);
    if (!activeView) return;
    setSessionSorting(null);
    setReadOnlyNotice(false);
    await loadQuotesForView(activeView, userId, activeView.sorting);
  }

  // ---------- Filter save ----------

  async function handleFilterSave(criteria: FilterCriterion[], filterLogic: string, ownerScope: OwnerScope) {
    if (!activeView) return;
    setActiveCriteria(criteria);
    setActiveFilterLogic(filterLogic);
    setActiveOwnerScope(ownerScope);
    if (canEditView(activeView)) {
      setSessionFilters(null);
      setReadOnlyNotice(false);
      const filters: ListViewFilter[] = [];
      if (ownerScope === 'mine') filters.push({ field: 'owner_user_id', operator: 'equals', value: '$CURRENT_USER' });
      for (const c of criteria) filters.push({ field: c.field, operator: c.operator, value: c.value });
      const updated = { ...activeView, filters, filter_logic: filterLogic };
      setActiveView(updated);
      await supabase.from('list_views').update({ filters, filter_logic: filterLogic, updated_at: new Date().toISOString() }).eq('id', activeView.id);
    } else {
      setSessionFilters({ criteria, filterLogic, ownerScope });
      setReadOnlyNotice(true);
    }
    setLastUpdated(new Date());
  }

  // ---------- View change ----------

  function handleViewChange(view: ListView) {
    setActiveView(view);
    setSessionColumns(null);
    setSessionSorting(null);
    setSessionFilters(null);
    setReadOnlyNotice(false);
    setSearchTerm('');
    setDebouncedSearch('');
    clearSelection();
    applyViewFilters(view);
    loadQuotesForView(view, userId);
    loadWidthsForView(view.id);
  }

  // ---------- View management ----------

  function getEffectiveFiltersForSave(): ListViewFilter[] {
    const criteria = sessionFilters?.criteria ?? activeCriteria;
    const scope = sessionFilters?.ownerScope ?? activeOwnerScope;
    const filters: ListViewFilter[] = [];
    if (scope === 'mine') filters.push({ field: 'owner_user_id', operator: 'equals', value: '$CURRENT_USER' });
    for (const c of criteria) filters.push({ field: c.field, operator: c.operator, value: c.value });
    return filters;
  }

  function getEffectiveFilterLogicForSave(): string {
    return sessionFilters?.filterLogic ?? activeFilterLogic;
  }

  function handleViewCreated(view: ListView) {
    setActiveView(view);
    setSessionColumns(null);
    setSessionSorting(null);
    setSessionFilters(null);
    setReadOnlyNotice(false);
    applyViewFilters(view);
    loadQuotesForView(view, userId);
    setToast('List view created');
  }

  function handleViewUpdated(view: ListView) {
    setActiveView(view);
    setToast('List view updated');
  }

  async function handleViewDeleted(deletedId: string) {
    if (!userId) return;
    const { data: prefs } = await supabase
      .from('user_list_view_preferences')
      .select('pinned_list_view_id, recent_list_view_ids, display_prefs')
      .eq('user_id', userId).eq('object', 'quote').maybeSingle();
    const recentIds: string[] = (prefs?.recent_list_view_ids || []).filter((id: string) => id !== deletedId);
    const pinnedId = prefs?.pinned_list_view_id === deletedId ? null : prefs?.pinned_list_view_id;
    await supabase.from('user_list_view_preferences').upsert({
      user_id: userId, object: 'quote',
      pinned_list_view_id: pinnedId,
      recent_list_view_ids: recentIds,
      display_prefs: prefs?.display_prefs || {},
    }, { onConflict: 'user_id,object' });
    const fallbackId = pinnedId || SYSTEM_VIEW_RECENT;
    const { data: fallback } = await supabase.from('list_views').select('*').eq('id', fallbackId).maybeSingle();
    if (fallback) handleViewChange(fallback as ListView);
    else {
      const { data: allView } = await supabase.from('list_views').select('*').eq('id', SYSTEM_VIEW_ALL).maybeSingle();
      if (allView) handleViewChange(allView as ListView);
    }
    setToast('List view deleted');
  }

  async function loadWidthsForView(viewId: string) {
    if (!userId) return;
    const { data: prefs } = await supabase
      .from('user_list_view_preferences').select('display_prefs')
      .eq('user_id', userId).eq('object', 'quote').maybeSingle();
    const dp = (prefs?.display_prefs as Record<string, Record<string, number>>) || {};
    setColWidths(dp[viewId] || {});
  }

  // ---------- Column resizing ----------

  function onResizeStart(e: React.MouseEvent, field: string) {
    e.preventDefault();
    const th = (e.target as HTMLElement).closest('th');
    if (!th) return;
    const startW = th.getBoundingClientRect().width;
    resizingRef.current = { field, startX: e.clientX, startW };
    function onMove(ev: MouseEvent) {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      const newW = Math.max(60, resizingRef.current.startW + diff);
      setColWidths(prev => ({ ...prev, [resizingRef.current!.field]: newW }));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      persistWidths();
      resizingRef.current = null;
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  async function persistWidths() {
    if (!userId || !activeView) return;
    const { data: prefs } = await supabase
      .from('user_list_view_preferences')
      .select('display_prefs, pinned_list_view_id, recent_list_view_ids')
      .eq('user_id', userId).eq('object', 'quote').maybeSingle();
    const existing = (prefs?.display_prefs as Record<string, unknown>) || {};
    const updated = { ...existing, [activeView.id]: colWidths };
    await supabase.from('user_list_view_preferences').upsert({
      user_id: userId, object: 'quote',
      pinned_list_view_id: prefs?.pinned_list_view_id || null,
      recent_list_view_ids: prefs?.recent_list_view_ids || [],
      display_prefs: updated,
    }, { onConflict: 'user_id,object' });
  }

  // ---------- Cell rendering ----------

  function renderCell(quote: Quote, field: string): React.ReactNode {
    const fieldDef = FIELD_CATALOG_MAP.get(field);
    if (!fieldDef) return '-';
    if (field === 'total_amount') {
      const amount = calculateTotalAmount(quote.id);
      if (amount <= 0) return '\u2014';
      const sym = quote.currency === 'MXN' ? 'MX$' : '$';
      return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (field === 'customer_review_status') {
      const status = calculateQuoteReviewStatus(quote);
      if (!status || status === 'pending') return '-';
      const cfg: Record<string, { label: string; classes: string }> = {
        accepted: { label: 'Accepted', classes: 'text-green-700 bg-green-50' },
        rejected: { label: 'Rejected', classes: 'text-red-700 bg-red-50' },
        negotiate: { label: 'Negotiating', classes: 'text-blue-700 bg-blue-50' },
        mixed: { label: 'Mixed', classes: 'text-amber-700 bg-amber-50' },
        expired: { label: 'Expired', classes: 'text-gray-600 bg-gray-100' },
      };
      const c = cfg[status];
      if (!c) return status;
      return <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${c.classes}`}>{c.label}</span>;
    }
    if (field === 'stage') {
      const stage = quote.stage || 'New';
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full w-fit ${STAGE_COLORS[stage] || STAGE_COLORS['New']}`}>
          {isQuoteLocked(stage) && <Lock className="w-3 h-3" />}
          {stage}
        </span>
      );
    }
    const raw = (quote as unknown as Record<string, unknown>)[field];
    if (raw == null || raw === '') return '-';
    if (fieldDef.dataType === 'currency') {
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (isNaN(num) || num === 0) return '\u2014';
      const sym = quote.currency === 'MXN' ? 'MX$' : '$';
      return `${sym}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (fieldDef.dataType === 'datetime') {
      const d = new Date(String(raw));
      if (isNaN(d.getTime())) return String(raw);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    if (fieldDef.dataType === 'date') {
      const d = new Date(String(raw));
      if (isNaN(d.getTime())) return String(raw);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    return String(raw);
  }

  // ---------- Selection ----------

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); setSelectionCapHit(false); }
      else if (next.size >= SELECTION_CAP) { setSelectionCapHit(true); }
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredQuotes.length) {
      clearSelection();
    } else {
      const ids = filteredQuotes.slice(0, SELECTION_CAP).map(q => q.id);
      setSelectedIds(new Set(ids));
      setSelectionCapHit(filteredQuotes.length > SELECTION_CAP);
    }
  }

  // ---------- Delete ----------

  async function handleDeleteConfirm() {
    if (!deleteConfirmId) return;
    setDeleteConfirmId(null);
    await onDeleteQuote(deleteConfirmId);
    setAllQuotes(prev => prev.filter(q => q.id !== deleteConfirmId));
    setTotalCount(prev => Math.max(0, prev - 1));
    setToast('Quote deleted successfully');
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const selected = filteredQuotes.filter(q => selectedIds.has(q.id));
    const unlocked = selected.filter(q => !isQuoteLocked(q.stage));
    const lockedCount = selected.length - unlocked.length;
    let deletedCount = 0;
    for (const q of unlocked) {
      try {
        await onDeleteQuote(q.id);
        deletedCount++;
      } catch { /* skip failed */ }
    }
    setAllQuotes(prev => {
      const deletedIds = new Set(unlocked.slice(0, deletedCount).map(q => q.id));
      return prev.filter(q => !deletedIds.has(q.id));
    });
    setTotalCount(prev => Math.max(0, prev - deletedCount));
    clearSelection();
    setBulkDeleteOpen(false);
    setBulkDeleting(false);
    if (lockedCount > 0) {
      setToast(`${deletedCount} deleted, ${lockedCount} skipped (locked)`);
    } else {
      setToast(`${deletedCount} quote${deletedCount !== 1 ? 's' : ''} deleted`);
    }
  }

  async function handleClone(quote: Quote) {
    setCloningId(quote.id);
    await onCloneQuote(quote);
    setCloningId(null);
  }

  // ---------- Row action menu ----------

  function openRowMenu(e: React.MouseEvent, quoteId: string) {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    setRowMenuPos({ top: rect.bottom + 4, left: rect.right - 180 });
    setRowMenuId(quoteId);
  }

  // ---------- Derived ----------

  const linkField = effectiveColumns.find(c => isLinkField(c.field))?.field || null;
  const hasActiveFilters = effectiveCriteria.length > 0 || effectiveOwnerScope === 'mine';
  const hasFiltersOrSearch = hasActiveFilters || debouncedSearch.trim().length > 0;
  const colCount = effectiveColumns.length + 2; // checkbox + actions

  // ---------- Error state ----------

  if (errorState && !loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-8 py-10">
          <QuotesHomeHeader
            activeView={activeView}
            onViewChange={handleViewChange}
            itemCount={0}
            lastUpdated={lastUpdated}
            effectiveSorting={effectiveSorting}
            filterCount={effectiveCriteria.length + (effectiveOwnerScope === 'mine' ? 1 : 0)}
            hasSearch={debouncedSearch.trim().length > 0}
          />
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-4">
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{errorState}</p>
              <button
                onClick={() => { setErrorState(null); initializeView(); }}
                className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Initial loading ----------

  if (loading && !activeView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading quotes...</p>
        </div>
      </div>
    );
  }

  // ---------- Skeleton rows ----------

  function renderSkeletonRows(count: number) {
    return Array.from({ length: count }).map((_, i) => (
      <tr key={`skel-${i}`} className="animate-pulse">
        <td className="px-4 py-3.5"><div className="w-4 h-4 bg-gray-200 rounded" /></td>
        {effectiveColumns.map(col => (
          <td key={col.field} className="px-4 py-3.5">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </td>
        ))}
        <td className="px-4 py-3.5 text-right"><div className="h-4 w-6 bg-gray-200 rounded ml-auto" /></td>
      </tr>
    ));
  }

  // ---------- Render ----------

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <div className="flex items-start justify-between gap-4">
          <QuotesHomeHeader
            activeView={activeView}
            onViewChange={handleViewChange}
            itemCount={displayCount}
            lastUpdated={lastUpdated}
            effectiveSorting={effectiveSorting}
            filterCount={effectiveCriteria.length + (effectiveOwnerScope === 'mine' ? 1 : 0)}
            hasSearch={debouncedSearch.trim().length > 0}
          />
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Top row: primary actions */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Selection chip */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
                    {selectedIds.size} selected
                    <button onClick={clearSelection} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
                  </span>
                  <button
                    onClick={() => setBulkDeleteOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete selected
                  </button>
                </div>
              )}

              {selectionCapHit && (
                <span className="text-[10px] text-amber-600">Max {SELECTION_CAP} rows</span>
              )}

              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Quote
              </button>
            </div>

            {/* Second row: list controls */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search this list..."
                  className="pl-8 pr-8 py-2 w-52 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
                {searchTerm && (
                  <button onClick={() => { setSearchTerm(''); setDebouncedSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter button */}
              <div className="relative">
                <button
                  onClick={() => setFilterPanelOpen(true)}
                  className={`p-2 rounded-lg border transition-colors ${hasActiveFilters ? 'border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100' : 'border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700'}`}
                  title="Filters"
                >
                  <Filter className="w-4 h-4" />
                </button>
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center pointer-events-none">
                    {effectiveCriteria.length + (effectiveOwnerScope === 'mine' ? 1 : 0)}
                  </span>
                )}
              </div>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Gear menu */}
              <div className="relative" ref={gearRef}>
                <button
                  onClick={() => setGearOpen(!gearOpen)}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
                  title="View options"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {gearOpen && (
                  <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-40 py-1">
                    <button onClick={() => { setGearOpen(false); setViewModalType('new'); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                      <FilePlus className="w-4 h-4 text-gray-400" /> New
                    </button>
                    <button onClick={() => { setGearOpen(false); setViewModalType('clone'); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                      <Copy className="w-4 h-4 text-gray-400" /> Clone
                    </button>
                    <button onClick={() => { if (canEditView(activeView)) { setGearOpen(false); setViewModalType('rename'); } }} disabled={!canEditView(activeView)} title={activeView?.is_system ? "System views can't be modified" : undefined} className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left ${canEditView(activeView) ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-300 cursor-not-allowed'}`}>
                      <Pencil className="w-4 h-4 text-gray-400" /> Rename
                    </button>
                    <button onClick={() => { if (canEditView(activeView)) { setGearOpen(false); setViewModalType('sharing'); } }} disabled={!canEditView(activeView)} title={activeView?.is_system ? "System views can't be modified" : undefined} className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left ${canEditView(activeView) ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-300 cursor-not-allowed'}`}>
                      <Share2 className="w-4 h-4 text-gray-400" /> Sharing Settings
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button onClick={() => { setGearOpen(false); setSelectFieldsOpen(true); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                      <Columns3 className="w-4 h-4 text-gray-400" /> Select Fields to Display
                    </button>
                    <button onClick={() => { if (canEditView(activeView)) { setGearOpen(false); setViewModalType('delete'); } }} disabled={!canEditView(activeView)} title={activeView?.is_system ? "System views can't be modified" : undefined} className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left ${canEditView(activeView) ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button onClick={resetSorting} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                      <ResetIcon className="w-4 h-4 text-gray-400" /> Reset Column Sorting
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {readOnlyNotice && (
          <div className="mb-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
            View is read-only — changes won't be saved. Clone the view to keep them.
          </div>
        )}

        {/* Refreshing indicator */}
        {refreshing && (
          <div className="h-0.5 bg-blue-100 rounded overflow-hidden mb-0">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-260px)]" ref={scrollContainerRef}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  {/* Master checkbox */}
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredQuotes.length > 0 && selectedIds.size === filteredQuotes.length}
                      ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredQuotes.length; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  {effectiveColumns.map(col => {
                    const fieldDef = FIELD_CATALOG_MAP.get(col.field);
                    const sortable = fieldDef?.sortable ?? false;
                    const align = fieldDef?.align || 'left';
                    const isActive = effectiveSorting[0]?.field === col.field;
                    const dir = isActive ? effectiveSorting[0].direction : null;
                    const width = colWidths[col.field];
                    return (
                      <th
                        key={col.field}
                        style={width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
                        className={`relative px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider select-none group ${align === 'right' ? 'text-right' : 'text-left'}`}
                      >
                        <button
                          onClick={() => sortable && handleSort(col.field)}
                          className={`inline-flex items-center gap-1 ${sortable ? 'cursor-pointer hover:text-gray-900' : 'cursor-default'}`}
                        >
                          {col.label}
                          {sortable && isActive && dir === 'asc' && <ArrowUp className="w-3 h-3 text-blue-600" />}
                          {sortable && isActive && dir === 'desc' && <ArrowDown className="w-3 h-3 text-blue-600" />}
                        </button>
                        <div
                          onMouseDown={e => onResizeStart(e, col.field)}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-blue-300 transition-opacity"
                        />
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Skeleton rows on first load */}
                {loading && renderSkeletonRows(8)}

                {/* Empty state */}
                {!loading && filteredQuotes.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="px-6 py-16 text-center">
                      <p className="text-sm text-gray-500 mb-4">
                        {debouncedSearch.trim()
                          ? `No Quotes match "${debouncedSearch.trim()}".`
                          : 'No Quotes match the current filters.'}
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        {hasFiltersOrSearch && (
                          <button
                            onClick={() => {
                              setSearchTerm('');
                              setDebouncedSearch('');
                              setActiveCriteria([]);
                              setActiveFilterLogic('');
                              setActiveOwnerScope('all');
                              setSessionFilters(null);
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Clear Filters
                          </button>
                        )}
                        <button
                          onClick={onCreateNew}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          New Quote
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {!loading && filteredQuotes.map(quote => {
                  const isSelected = selectedIds.has(quote.id);
                  return (
                    <tr key={quote.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-4 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(quote.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      {effectiveColumns.map(col => {
                        const fieldDef = FIELD_CATALOG_MAP.get(col.field);
                        const align = fieldDef?.align || 'left';
                        const isLink = col.field === linkField;
                        return (
                          <td key={col.field} className={`px-4 py-3.5 whitespace-nowrap text-sm ${align === 'right' ? 'text-right' : 'text-left'}`}>
                            {isLink ? (
                              <div className="flex items-center gap-2">
                                <button onClick={() => onSelectQuote(quote.id)} className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left">
                                  {renderCell(quote, col.field)}
                                </button>
                                {quote.quote_number?.endsWith('-NEG') && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                                    <GitBranch className="w-2.5 h-2.5" /> REVISION
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-900">{renderCell(quote, col.field)}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right w-12">
                        <button
                          onClick={e => openRowMenu(e, quote.id)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Loading more spinner */}
                {loadingMore && (
                  <tr>
                    <td colSpan={colCount} className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                        Loading more...
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Infinite scroll sentinel */}
            {hasMore && !loading && <div ref={sentinelRef} className="h-1" />}
          </div>
        </div>
      </div>

      {/* Row action menu (portal) */}
      {rowMenuId && rowMenuPos && createPortal(
        <div
          ref={rowMenuRef}
          style={{ position: 'fixed', top: rowMenuPos.top, left: rowMenuPos.left, zIndex: 9999 }}
          className="w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
        >
          {(() => {
            const quote = filteredQuotes.find(q => q.id === rowMenuId);
            if (!quote) return null;
            const locked = isQuoteLocked(quote.stage);
            return (
              <>
                <button
                  onClick={() => { setRowMenuId(null); onSelectQuote(quote.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                >
                  <Eye className="w-4 h-4 text-gray-400" /> View
                </button>
                <button
                  onClick={() => { setRowMenuId(null); handleClone(quote); }}
                  disabled={cloningId === quote.id}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left disabled:opacity-50"
                >
                  <Copy className="w-4 h-4 text-gray-400" /> Clone
                </button>
                <button
                  onClick={() => { if (!locked) { setRowMenuId(null); setDeleteConfirmId(quote.id); } }}
                  disabled={locked}
                  title={locked ? "Locked quotes can't be deleted" : undefined}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${locked ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Single delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Quote</h3>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this quote? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDeleteConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirm */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete {selectedIds.size} Quote{selectedIds.size !== 1 ? 's' : ''}</h3>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete the selected quotes? Locked quotes will be skipped. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 transition-colors">
                {bulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in">{toast}</div>
      )}

      <SelectFieldsModal
        isOpen={selectFieldsOpen}
        onClose={() => setSelectFieldsOpen(false)}
        columns={effectiveColumns}
        onSave={handleColumnsChange}
        isReadOnly={!canEditView(activeView)}
      />

      <FilterPanel
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        criteria={effectiveCriteria}
        filterLogic={effectiveFilterLogic}
        ownerScope={effectiveOwnerScope}
        ownerProfiles={ownerProfiles}
        isReadOnly={!canEditView(activeView)}
        onSave={handleFilterSave}
      />

      <ListViewModals
        modalType={viewModalType}
        onClose={() => setViewModalType(null)}
        activeView={activeView}
        userId={userId}
        isAdmin={isAdmin}
        effectiveColumns={effectiveColumns}
        effectiveSorting={effectiveSorting}
        effectiveFilters={getEffectiveFiltersForSave()}
        effectiveFilterLogic={getEffectiveFilterLogicForSave()}
        onViewCreated={handleViewCreated}
        onViewUpdated={handleViewUpdated}
        onViewDeleted={handleViewDeleted}
      />
    </div>
  );
}
