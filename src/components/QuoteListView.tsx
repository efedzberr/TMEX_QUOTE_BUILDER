import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Copy, Settings, Lock, CheckCircle, XCircle, RotateCcw, Zap, GitBranch } from 'lucide-react';
import { supabase, Quote, QuoteLane } from '../lib/supabase';
import { isQuoteLocked } from '../lib/constants';
import { calculateQuoteReviewStatus } from '../lib/customerPortalHelpers';

interface QuoteListViewProps {
  onCreateNew: () => void;
  onSelectQuote: (quoteId: string) => void;
  onDeleteQuote: (quoteId: string) => void;
  onCloneQuote: (quote: Quote) => void;
  onAdministration: () => void;
}

const STAGE_COLORS: Record<string, string> = {
  'New': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'Branch Manager Approval': 'bg-orange-100 text-orange-800',
  'Sent to Customer': 'bg-teal-100 text-teal-800',
  'Published': 'bg-gray-100 text-gray-800',
};

export function QuoteListView({ onCreateNew, onSelectQuote, onDeleteQuote, onCloneQuote, onAdministration }: QuoteListViewProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteLanes, setQuoteLanes] = useState<Record<string, QuoteLane[]>>({});
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadQuotes();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function loadQuotes() {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length === 0) {
        await createDummyQuotes();
        await loadQuotes();
      } else if (data) {
        setQuotes(data);
        await loadLanesForQuotes(data);
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLanesForQuotes(quotes: Quote[]) {
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

  async function createDummyQuotes() {
    const dummyQuotes = [
      {
        quote_number: 'TMQ-00000011',
        owner_name: 'Susana Guajardo',
        stage: 'New',
        total_amount: 3183.00,
        partner_account: 'PACCAR INC',
        shipper: 'PACCAR INC SHIPPER',
        type_of_service: 'Dry Van',
        partner_count: 2,
      },
      {
        quote_number: 'TMQ-00000012',
        owner_name: 'Daniel Rodriguez',
        stage: 'In Progress',
        total_amount: 4567.50,
        partner_account: 'WALMART',
        shipper: 'WALMART SHIPPER',
        type_of_service: 'Reefer',
        partner_count: 3,
      },
      {
        quote_number: 'TMQ-00000013',
        owner_name: 'Marinthia Sierra',
        stage: 'Branch Manager Approval',
        total_amount: 2890.75,
        partner_account: 'KIMBERLY CLARK',
        shipper: 'KIMBERLY CLARK SHIPPER',
        type_of_service: 'Dry Van',
        partner_count: 1,
      },
      {
        quote_number: 'TMQ-00000014',
        owner_name: 'Brenda Guayante',
        stage: 'Sent to Customer',
        total_amount: 5234.25,
        partner_account: 'AMAZON.COM',
        shipper: 'AMAZON.COM SHIPPER',
        type_of_service: 'Flatbed',
        partner_count: 2,
      },
      {
        quote_number: 'TMQ-00000015',
        owner_name: 'Gabriela Longoria',
        stage: 'Published',
        total_amount: 1925.00,
        partner_account: 'CEREALTO',
        shipper: 'CEREALTO SHIPPER',
        type_of_service: 'Dry Van',
        partner_count: 2,
      },
    ];

    for (const quote of dummyQuotes) {
      await supabase.from('quotes').insert(quote);
    }
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

  if (loading) {
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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/Transmex_Logo_II.jpeg"
                alt="Transmex Logo"
                className="h-10 object-contain"
              />
              <div className="text-sm text-gray-500">Smart Pricing Hub</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onAdministration}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Administration
              </button>
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create New Quote
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">All Quotes</h1>
            <span className="text-sm text-gray-500">{quotes.length} {quotes.length === 1 ? 'quote' : 'quotes'}</span>
          </div>

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
                    Owner
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
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
        </div>
      </main>

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
