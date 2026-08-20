import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, Copy, Lock, CheckCircle, XCircle, RotateCcw, GitBranch, Zap } from 'lucide-react';
import { supabase, Quote, QuoteLane } from '../lib/supabase';
import { isQuoteLocked } from '../lib/constants';
import { calculateQuoteReviewStatus } from '../lib/customerPortalHelpers';
import { QuotesHomeHeader, ListView, ListViewFilter } from './QuotesHomeHeader';

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
const SYSTEM_VIEW_MY = 'a0000000-0000-0000-0000-000000000002';
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

  useEffect(() => {
    initializeView();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function initializeView() {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id || null;
    setUserId(uid);

    let pinnedViewId: string | null = null;
    if (uid) {
      const { data: prefs } = await supabase
        .from('user_list_view_preferences')
        .select('pinned_list_view_id')
        .eq('user_id', uid)
        .eq('object', 'quote')
        .maybeSingle();
      if (prefs?.pinned_list_view_id) {
        pinnedViewId = prefs.pinned_list_view_id;
      }
    }

    const defaultViewId = pinnedViewId || SYSTEM_VIEW_RECENT;

    const { data: viewData } = await supabase
      .from('list_views')
      .select('*')
      .eq('id', defaultViewId)
      .maybeSingle();

    const view = viewData as ListView | null;
    if (view) {
      setActiveView(view);
      await loadQuotesForView(view, uid);
    } else {
      const { data: fallback } = await supabase
        .from('list_views')
        .select('*')
        .eq('id', SYSTEM_VIEW_ALL)
        .maybeSingle();
      const fb = fallback as ListView | null;
      setActiveView(fb);
      await loadQuotesForView(fb, uid);
    }
  }

  const loadQuotesForView = useCallback(async (view: ListView | null, uid: string | null) => {
    setLoading(true);
    try {
      let data: Quote[] | null = null;

      if (view && isRecentlyViewedFilter(view.filters)) {
        data = await fetchRecentlyViewed(uid);
      } else if (view && isMyQuotesFilter(view.filters, uid)) {
        data = await fetchMyQuotes(uid, view.sorting);
      } else {
        data = await fetchAllQuotes(view?.sorting);
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
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .in('id', ids);

    if (!data) return [];
    const orderMap = new Map(ids.map((id, i) => [id, i]));
    return data.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
  }

  async function fetchMyQuotes(uid: string | null, sorting?: { field: string; direction: string }[]): Promise<Quote[]> {
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

  async function fetchAllQuotes(sorting?: { field: string; direction: string }[]): Promise<Quote[]> {
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
      const { data, error } = await supabase
        .from('quote_lanes')
        .select('*')
        .in('quote_id', quoteIds);

      if (error) throw error;

      if (data) {
        const lanesByQuote: Record<string, QuoteLane[]> = {};
        data.forEach((lane) => {
          if (!lanesByQuote[lane.quote_id]) {
            lanesByQuote[lane.quote_id] = [];
          }
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

  function handleViewChange(view: ListView) {
    setActiveView(view);
    loadQuotesForView(view, userId);
  }

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
          />
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Quote
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quote Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Parent Account
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shipper
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Equipment Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Origin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotes.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500">
                        No quotes found for this view.
                      </td>
                    </tr>
                  )}
                  {quotes.map((quote) => (
                    <tr
                      key={quote.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectQuote(quote.id)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                          >
                            {quote.quote_number || quote.generated_quote_name}
                          </button>
                          {quote.quote_number?.endsWith('-NEG') && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                              <GitBranch className="w-2.5 h-2.5" />
                              REVISION
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{quote.partner_account || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{quote.shipper || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {(() => {
                            const totalAmount = calculateTotalAmount(quote.id);
                            return totalAmount > 0
                              ? `${quote.currency === 'MXN' ? 'MX$' : '$'}${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—';
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{quote.type_of_service || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full w-fit ${
                              STAGE_COLORS[quote.stage || 'New'] || STAGE_COLORS['New']
                            }`}
                          >
                            {isQuoteLocked(quote.stage) && <Lock className="w-3 h-3" />}
                            {quote.stage || 'New'}
                          </span>
                          {(() => {
                            const reviewStatus = calculateQuoteReviewStatus(quote);
                            if (!reviewStatus || reviewStatus === 'pending') return null;
                            const statusConfig: Record<string, { icon: typeof CheckCircle; label: string; classes: string }> = {
                              accepted: { icon: CheckCircle, label: 'Accepted', classes: 'text-green-700 bg-green-50' },
                              rejected: { icon: XCircle, label: 'Rejected', classes: 'text-red-700 bg-red-50' },
                              negotiate: { icon: RotateCcw, label: 'Negotiating', classes: 'text-blue-700 bg-blue-50' },
                              mixed: { icon: Zap, label: 'Mixed', classes: 'text-amber-700 bg-amber-50' },
                              expired: { icon: XCircle, label: 'Expired', classes: 'text-gray-600 bg-gray-100' },
                            };
                            const cfg = statusConfig[reviewStatus];
                            if (!cfg) return null;
                            const Icon = cfg.icon;
                            return (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded w-fit ${cfg.classes}`}>
                                <Icon className="w-2.5 h-2.5" />
                                {cfg.label}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {quote.is_mass_update && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <Zap className="w-3 h-3" /> MASS UPDATE
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{quote.owner_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
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
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete this quote? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
