import { useState } from 'react';
import { Copy, RefreshCw, Eye, CheckCircle, XCircle, RotateCcw, Zap, Clock, PenTool, ExternalLink } from 'lucide-react';
import { Quote, QuoteLane } from '../lib/supabase';
import { getPortalUrl, calculateQuoteReviewStatus } from '../lib/customerPortalHelpers';

interface CustomerReviewBannerProps {
  quote: Quote;
  lanes: QuoteLane[];
  onResend: () => void;
  onViewResponse: () => void;
  onProcessResponse?: () => void;
  onViewSignature?: () => void;
  onViewRevisionQuote?: () => void;
}

export function CustomerReviewBanner({ quote, onResend, onViewResponse, onViewSignature, onViewRevisionQuote }: CustomerReviewBannerProps) {
  const status = calculateQuoteReviewStatus(quote);
  const [copied, setCopied] = useState(false);

  if (!status) return null;

  const formatDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const acceptance = quote.lane_acceptance || {};
  const acceptanceValues = Object.values(acceptance);
  const acceptedCount = acceptanceValues.filter(g => g.status === 'accepted').length;
  const rejectedCount = acceptanceValues.filter(g => g.status === 'rejected').length;
  const negotiateCount = acceptanceValues.filter(g => g.status === 'negotiate').length;

  async function handleCopyLink() {
    if (!quote.review_token) return;
    try {
      await navigator.clipboard.writeText(getPortalUrl(quote.review_token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (status === 'pending') {
    return (
      <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <span className="text-base">📧</span>
            <span>
              Sent to customer on <strong>{formatDate(quote.token_generated_at)}</strong>.
              Expires <strong>{formatDate(quote.token_expires_at)}</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={onResend}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Resend
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="bg-green-50 border-b border-green-200">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <CheckCircle className="w-4 h-4" />
            <span>
              Fully accepted by <strong>{quote.customer_name || 'customer'}</strong> on <strong>{formatDate(quote.customer_responded_at)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onViewSignature && quote.customer_signature_data && (
              <button
                onClick={onViewSignature}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
              >
                <PenTool className="w-3.5 h-3.5" />
                View Signature
              </button>
            )}
            <button
              onClick={onViewResponse}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View Response
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="bg-red-50 border-b border-red-200">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-red-800">
            <XCircle className="w-4 h-4" />
            <span>
              All lanes rejected by <strong>{quote.customer_name || 'customer'}</strong> on <strong>{formatDate(quote.customer_responded_at)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewResponse}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View Response
            </button>
            {onViewRevisionQuote && quote.negotiation_quote_id && (
              <button
                onClick={onViewRevisionQuote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Revision Quote
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'negotiate') {
    return (
      <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <RotateCcw className="w-4 h-4" />
            <span>
              Customer requested negotiation on all lanes — <strong>{formatDate(quote.customer_responded_at)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewResponse}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View Response
            </button>
            {onViewRevisionQuote && quote.negotiation_quote_id && (
              <button
                onClick={onViewRevisionQuote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Revision Quote
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'mixed') {
    const mixedParts: string[] = [];
    if (acceptedCount) mixedParts.push(`${acceptedCount} accepted`);
    if (rejectedCount) mixedParts.push(`${rejectedCount} rejected`);
    if (negotiateCount) mixedParts.push(`${negotiateCount} negotiating`);
    const mixedSummary = mixedParts.join(', ');

    return (
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Zap className="w-4 h-4" />
            <span>
              Mixed response from <strong>{quote.customer_name || 'customer'}</strong> on <strong>{formatDate(quote.customer_responded_at)}</strong>
              {mixedSummary && <> — {mixedSummary}</>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onViewSignature && quote.customer_signature_data && (
              <button
                onClick={onViewSignature}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <PenTool className="w-3.5 h-3.5" />
                View Signature
              </button>
            )}
            <button
              onClick={onViewResponse}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View Response
            </button>
            {onViewRevisionQuote && quote.negotiation_quote_id && (
              <button
                onClick={onViewRevisionQuote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Revision Quote
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>
              Customer link expired on <strong>{formatDate(quote.token_expires_at)}</strong> with no response.
            </span>
          </div>
          <button
            onClick={onResend}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Resend
          </button>
        </div>
      </div>
    );
  }

  return null;
}
