import { useEffect } from 'react';
import { X, CheckCircle, XCircle, RotateCcw, ExternalLink, PenTool } from 'lucide-react';
import { Quote, QuoteLane } from '../lib/supabase';
import { buildLaneAcceptanceGroups } from '../lib/customerPortalHelpers';
import { loadSignatureFonts } from '../lib/portalSubmission';

interface ViewResponseModalProps {
  quote: Quote;
  lanes: QuoteLane[];
  onClose: () => void;
  onNavigateToRevision?: () => void;
}

export function ViewResponseModal({ quote, lanes, onClose, onNavigateToRevision }: ViewResponseModalProps) {
  const groups = buildLaneAcceptanceGroups(lanes);
  const acceptance = quote.lane_acceptance || {};

  useEffect(() => {
    if (quote.customer_signature_font) {
      loadSignatureFonts();
    }
  }, [quote.customer_signature_font]);

  const formatDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const acceptanceValues = Object.values(acceptance);
  const acceptedCount = acceptanceValues.filter(g => g.status === 'accepted').length;
  const rejectedCount = acceptanceValues.filter(g => g.status === 'rejected').length;
  const negotiateCount = acceptanceValues.filter(g => g.status === 'negotiate').length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[560px] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Customer Response</h2>
            <p className="text-xs text-gray-500">
              {quote.quote_number || quote.generated_quote_name}
              {quote.customer_responded_at && ` -- ${formatDate(quote.customer_responded_at)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {(quote.customer_name || quote.customer_title) && (
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Customer</div>
                <div className="text-sm font-medium text-gray-900">{quote.customer_name || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Title</div>
                <div className="text-sm font-medium text-gray-900">{quote.customer_title || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Status</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {acceptedCount > 0 && <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 rounded">{acceptedCount} accepted</span>}
                  {rejectedCount > 0 && <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded">{rejectedCount} rejected</span>}
                  {negotiateCount > 0 && <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded">{negotiateCount} negotiating</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 space-y-3">
          {groups.map(group => {
            const response = acceptance[`group_${group.group_id}`] || acceptance[group.group_id];
            const status = response?.status;
            const comment = response?.comment;

            return (
              <div
                key={group.group_id}
                className={`rounded-lg border p-3 ${
                  status === 'accepted' ? 'border-green-200 bg-green-50' :
                  status === 'rejected' ? 'border-red-200 bg-red-50' :
                  status === 'negotiate' ? 'border-blue-200 bg-blue-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{group.label}</div>
                    <div className="text-[10px] text-gray-500">
                      {group.origin} → {group.destination}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {status === 'accepted' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {status === 'rejected' && <XCircle className="w-4 h-4 text-red-600" />}
                    {status === 'negotiate' && <RotateCcw className="w-4 h-4 text-blue-600" />}
                    <span className={`text-xs font-semibold ${
                      status === 'accepted' ? 'text-green-700' :
                      status === 'rejected' ? 'text-red-700' :
                      status === 'negotiate' ? 'text-blue-700' :
                      'text-gray-500'
                    }`}>
                      {status === 'accepted' ? 'Accepted' :
                       status === 'rejected' ? 'Rejected' :
                       status === 'negotiate' ? 'Negotiating' :
                       'No Response'}
                    </span>
                  </div>
                </div>
                {comment && (
                  <div className="mt-2 text-xs text-gray-600 bg-white/60 rounded px-2 py-1.5 border border-gray-100">
                    "{comment}"
                  </div>
                )}
              </div>
            );
          })}

          {groups.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No lane groups found.</p>
          )}
        </div>

        {(quote.customer_signature_data || (quote.customer_name && quote.customer_signature_font)) && (
          <div className="px-6 py-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <PenTool className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Signature</span>
            </div>
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 flex items-center justify-center min-h-[60px]">
              {quote.customer_signature_data ? (
                <img
                  src={quote.customer_signature_data}
                  alt="Customer Signature"
                  className="max-h-[50px] max-w-full object-contain"
                />
              ) : (
                <span
                  className="text-2xl text-gray-800"
                  style={{ fontFamily: `"${quote.customer_signature_font}", cursive` }}
                >
                  {quote.customer_name}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div>
            {onNavigateToRevision && quote.negotiation_quote_id && (
              <button
                onClick={() => { onClose(); onNavigateToRevision(); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Revision Quote
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
