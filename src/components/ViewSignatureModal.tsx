import { X, Download, PenTool } from 'lucide-react';
import { Quote } from '../lib/supabase';
import { useEffect } from 'react';
import { loadSignatureFonts } from '../lib/portalSubmission';

interface ViewSignatureModalProps {
  quote: Quote;
  onClose: () => void;
}

export function ViewSignatureModal({ quote, onClose }: ViewSignatureModalProps) {
  useEffect(() => {
    loadSignatureFonts();
  }, []);

  const formatDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  };

  const handleDownload = () => {
    if (!quote.customer_signature_data) return;
    const link = document.createElement('a');
    link.href = quote.customer_signature_data;
    link.download = `signature-${quote.quote_number || 'quote'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[480px] overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PenTool className="w-5 h-5 text-white/90" />
            <h2 className="text-lg font-bold text-white">Rate Accepted By</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Name</div>
              <div className="text-sm font-semibold text-gray-900">{quote.customer_name || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Title</div>
              <div className="text-sm font-semibold text-gray-900">{quote.customer_title || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Date</div>
              <div className="text-sm font-semibold text-gray-900">{formatDate(quote.customer_responded_at)}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Account</div>
              <div className="text-sm font-semibold text-gray-900">{quote.partner_account || '—'}</div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-3">Signature</div>
            {quote.customer_signature_data ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-center justify-center min-h-[100px]">
                <img
                  src={quote.customer_signature_data}
                  alt="Customer Signature"
                  className="max-h-[80px] max-w-full object-contain"
                />
              </div>
            ) : quote.customer_name && quote.customer_signature_font ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-center justify-center min-h-[100px]">
                <span
                  className="text-3xl text-gray-800"
                  style={{ fontFamily: `"${quote.customer_signature_font}", cursive` }}
                >
                  {quote.customer_name}
                </span>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-400 min-h-[100px] flex items-center justify-center">
                No signature available
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {quote.customer_signature_data ? (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Signature
            </button>
          ) : <div />}
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
