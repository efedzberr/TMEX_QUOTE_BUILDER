import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Pencil, Copy, Lock, CheckCircle, XCircle, RotateCcw, GitBranch, Zap, Settings, ArrowUp, ArrowDown, Columns3, RotateCcw as ResetIcon } from 'lucide-react';
import { supabase, Quote, QuoteLane } from '../lib/supabase';
import { isQuoteLocked } from '../lib/constants';
import { calculateQuoteReviewStatus } from '../lib/customerPortalHelpers';
import { QuotesHomeHeader, ListView, ListViewFilter, ListViewColumn, ListViewSort } from './QuotesHomeHeader';
import { SelectFieldsModal } from './SelectFieldsModal';
import { FIELD_CATALOG_MAP, isLinkField, sortLabelFromCatalog } from '../lib/quoteFieldCatalog';

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

export function QuoteListView({ onCreateNew, onSelectQuote, onDeleteQuote, onCloneQuote }: QuoteListViewProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteLanes, setQuoteLanes] = useState<Record<string, QuoteLane[]>>({});
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ListView | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Session overrides for system/uneditable views
  const [sessionColumns, setSessionColumns] = useState<ListViewColumn[] | null>(null);
  const [sessionSorting, setSessionSorting] = useState<ListViewSort[] | null>(null);
  const [readOnlyNotice, setReadOnlyNotice] = useState(false);

  // Gear menu
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);

  // Select fields modal
  const [selectFieldsOpen, setSelectFieldsOpen] = useState(false);

  // Column widths
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ field: string; startX: number; startW: number } | null>(null);

  useEffect(() => { initializeView(); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false);
    }
    if (gearOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gearOpen]);

  function canEditView(view: ListView | null): boolean {
    if (!view || view.is_system) return false;
    if (view.owner_user_id === userId) return true;
    if (view.visibility === 'public' && isAdmin) return true;
    return false;
  }

  async function initializeView() {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id || null;
    setUserId(uid);

    if (uid) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', uid)
        .maybeSingle();
      if (profile?.is_admin) setIsAdmin(true);
    }

    let pinnedViewId: string | null = null;
    if (uid) {
      const { data: prefs } = await supabase
        .from('user_list_view_preferences')
        .select('pinned_list_view_id, display_prefs')
        .eq('user_id', uid)
        .eq('object', 'quote')
        .maybeSingle();
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
      await loadQuotesForView(view, uid);
    } else {
      const { data: fallback } = await supabase.from('list_views').select('*').eq('id', SYSTEM_VIEW_ALL).maybeSingle();
      const fb = fallback as ListView | null;
      setActiveView(fb);
      await loadQuotesForView(fb, uid);
    }
  }

  const loadQuotesForView = useCallback(async (view: ListView | null, uid: string | null, sortOverride?: ListViewSort[]) => {
    setLoading(true);
    try {
      const sorting = sortOverride || view?.sorting;
      let data: Quote[] | null = null;

      if (view && isRecentlyViewedFilter(view.filters)) {
        data = await fetchRecentlyViewed(uid);
      } else if (view && isMyQuotesFilter(view.filters, uid)) {
        data = await fetchMyQuotes(uid, sorting);
      } else {
        data = await fetchAllQuotes(sorting);
      }

      if (data) {
        setQuotes(data);
        await loadLanesForQuotes(data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  function isRecentlyViewedFilter(filters: ListViewFilter[]): boolean {
    return filters?.some(f => f.special === 'recently_viewed') || false;
  }

  function isMyQuotesFilter(filters: ListViewFilter[], uid: string | null): boolean {
    if (!uid) return false;
    return filters?.some(f => f.field === 'owner_user_id' && f.operator === 'equals' && f.value === '$CURRENT_USER') || false;
  }

  async function fetchRecentlyViewed(uid: string | null): Promise<Quote[]> {
    if (!uid) return [];
    const { data: recentData } = await supabase
      .from('recent_record_views')
      .select('record_id')
      .eq('user_id', uid)
      .eq('object', 'quote')
      .order('viewed_at', { ascending: false })
      .limit(50);
    if (!recentData || recentData.length === 0) return [];
    const ids = recentData.map(r => r.record_id);
    const { data } = await supabase.from('quotes').select('*').in('id', ids);
    if (!data) return [];
    const orderMap = new Map(ids.map((id, i) => [id, i]));
    return data.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
  }

  async function fetchMyQuotes(uid: string | null, sorting?: ListViewSort[]): Promise<Quote[]> {
    if (!uid) return [];
    let query = supabase.from('quotes').select('*').eq('owner_user_id', uid);
    if (sorting && sorting.length > 0) {
      query = query.order(sorting[0].field, { ascending: sorting[0].direction === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    const { data } = await query;
    return data || [];
  }

  async function fetchAllQuotes(sorting?: ListViewSort[]): Promise<Quote[]> {
    let query = supabase.from('quotes').select('*');
    if (sorting && sorting.length > 0) {
      query = query.order(sorting[0].field, { ascending: sorting[0].direction === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    const { data } = await query;
    return data || [];
  }

  async function loadLanesForQuotes(quotes: Quote[]) {
    if (quotes.length === 0) return;
    try {
      const quoteIds = quotes.map(q => q.id);
      const { data, error } = await supabase.from('quote_lanes').select('*').in('quote_id', quoteIds);
      if (error) throw error;
      if (data) {
        const lanesByQuote: Record<string, QuoteLane[]> = {};
        data.forEach((lane) => {
          if (!lanesByQuote[lane.quote_id]) lanesByQuote[lane.quote_id] = [];
          lanesByQuote[lane.quote_id].push(lane);
        });
        setQuoteLanes(lanesByQuote);
      }
    } catch (error) {
      console.error('Error loading lanes:', error);
    }
  }

  function calculateTotalAmount(quoteId: string): number {
    const lanes = quoteLanes[quoteId] || [];
    return lanes.reduce((sum, lane) => sum + (lane.us_rate + lane.mx_rate + lane.border_crossing_fee + (lane.toll_rate || 0)), 0);
  }

  // --- Effective columns/sorting (session override or from view) ---
  const effectiveColumns: ListViewColumn[] = sessionColumns || activeView?.columns || [];
  const effectiveSorting: ListViewSort[] = sessionSorting || activeView?.sorting || [];

  // --- Column actions ---
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

  // --- Sorting ---
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

  // --- View change ---
  function handleViewChange(view: ListView) {
    setActiveView(view);
    setSessionColumns(null);
    setSessionSorting(null);
    setReadOnlyNotice(false);
    loadQuotesForView(view, userId);
    loadWidthsForView(view.id);
  }

  async function loadWidthsForView(viewId: string) {
    if (!userId) return;
    const { data: prefs } = await supabase
      .from('user_list_view_preferences')
      .select('display_prefs')
      .eq('user_id', userId)
      .eq('object', 'quote')
      .maybeSingle();
    const dp = (prefs?.display_prefs as Record<string, Record<string, number>>) || {};
    setColWidths(dp[viewId] || {});
  }

  // --- Column resizing ---
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
      .eq('user_id', userId)
      .eq('object', 'quote')
      .maybeSingle();
    const existing = (prefs?.display_prefs as Record<string, unknown>) || {};
    const updated = { ...existing, [activeView.id]: colWidths };
    await supabase.from('user_list_view_preferences').upsert({
      user_id: userId,
      object: 'quote',
      pinned_list_view_id: prefs?.pinned_list_view_id || null,
      recent_list_view_ids: prefs?.recent_list_view_ids || [],
      display_prefs: updated,
    }, { onConflict: 'user_id,object' });
  }

  // --- Cell rendering ---
  function renderCell(quote: Quote, field: string): React.ReactNode {
    const fieldDef = FIELD_CATALOG_MAP.get(field);
    if (!fieldDef) return '-';

    if (field === 'total_amount') {
      const amount = calculateTotalAmount(quote.id);
      if (amount <= 0) return '—';
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

    const raw = (quote as Record<string, unknown>)[field];
    if (raw == null || raw === '') return '-';

    if (fieldDef.dataType === 'currency') {
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (isNaN(num) || num === 0) return '—';
      const sym = quote.currency === 'MXN' ? 'MX$' : '$';
      return `${sym}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (fieldDef.dataType === 'datetime') {
      const d = new Date(String(raw));
      if (isNaN(d.getTime())) return String(raw);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    }

    if (fieldDef.dataType === 'date') {
      const d = new Date(String(raw));
      if (isNaN(d.getTime())) return String(raw);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    return String(raw);
  }

  // --- Delete / Clone ---
  async function handleDeleteConfirm() {
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    setDeleteConfirmId(null);
    await onDeleteQuote(deleteConfirmId);
    setQuotes(prev => prev.filter(q => q.id !== deleteConfirmId));
    setDeletingId(null);
    setToast('Quote deleted successfully');
  }

  async function handleClone(quote: Quote) {
    setCloningId(quote.id);
    await onCloneQuote(quote);
    setCloningId(null);
  }

  // --- Determine link column ---
  const linkField = effectiveColumns.find(c => isLinkField(c.field))?.field || null;

  if (loading && !activeView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quotes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <div className="flex items-start justify-between gap-4">
          <QuotesHomeHeader
            activeView={activeView}
            onViewChange={handleViewChange}
            itemCount={quotes.length}
            lastUpdated={lastUpdated}
            effectiveSorting={effectiveSorting}
          />
          <div className="flex items-center gap-2 shrink-0">
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
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-40 py-1">
                  <button
                    onClick={() => { setGearOpen(false); setSelectFieldsOpen(true); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <Columns3 className="w-4 h-4 text-gray-400" />
                    Select Fields to Display
                  </button>
                  <button
                    onClick={resetSorting}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <ResetIcon className="w-4 h-4 text-gray-400" />
                    Reset Column Sorting
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Quote
            </button>
          </div>
        </div>

        {readOnlyNotice && (
          <div className="mb-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
            View is read-only — changes won't be saved. Clone the view to keep them.
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-260px)]">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
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
                          {/* Resize handle */}
                          <div
                            onMouseDown={e => onResizeStart(e, col.field)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-blue-300 transition-opacity"
                          />
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotes.length === 0 && (
                    <tr>
                      <td colSpan={effectiveColumns.length + 1} className="px-6 py-12 text-center text-sm text-gray-500">
                        No quotes found for this view.
                      </td>
                    </tr>
                  )}
                  {quotes.map(quote => (
                    <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                      {effectiveColumns.map(col => {
                        const fieldDef = FIELD_CATALOG_MAP.get(col.field);
                        const align = fieldDef?.align || 'left';
                        const isLink = col.field === linkField;

                        return (
                          <td key={col.field} className={`px-4 py-3.5 whitespace-nowrap text-sm ${align === 'right' ? 'text-right' : 'text-left'}`}>
                            {isLink ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onSelectQuote(quote.id)}
                                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                                >
                                  {renderCell(quote, col.field)}
                                </button>
                                {quote.quote_number?.endsWith('-NEG') && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                                    <GitBranch className="w-2.5 h-2.5" />
                                    REVISION
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-900">{renderCell(quote, col.field)}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        {(() => {
                          const quoteLocked = isQuoteLocked(quote.stage);
                          return (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onSelectQuote(quote.id)}
                                title={quoteLocked ? 'View quote (locked)' : 'Edit quote'}
                                className={`p-1.5 rounded transition-colors ${quoteLocked ? 'text-gray-400 hover:bg-gray-50' : 'text-blue-600 hover:bg-blue-50'}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleClone(quote)}
                                disabled={cloningId === quote.id}
                                title="Clone quote"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => !quoteLocked && setDeleteConfirmId(quote.id)}
                                disabled={deletingId === quote.id || quoteLocked}
                                title={quoteLocked ? 'Cannot delete locked quote' : 'Delete quote'}
                                className={`p-1.5 rounded transition-colors disabled:opacity-50 ${quoteLocked ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}
