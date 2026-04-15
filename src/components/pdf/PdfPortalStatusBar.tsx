import { useState } from 'react';
import { Copy, RefreshCw, Mail, CheckCircle, XCircle, ArrowLeftRight, Clock, FlaskConical } from 'lucide-react';
import type { Quote } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { getPortalUrl } from '../../lib/customerPortalHelpers';

interface Props {
  quote: Quote;
  onResend: () => void;
  onViewResponse?: () => void;
  onToast?: (msg: string, type: 'success' | 'error') => void;
}

export function PdfPortalStatusBar({ quote, onResend, onViewResponse, onToast }: Props) {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const status = quote.customer_review_status;

  if (!status || !quote.review_token) return null;

  function handleCopy() {
    if (!quote.review_token) return;
    navigator.clipboard.writeText(getPortalUrl(quote.review_token)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  async function handleTestEmail() {
    const testTo = quote.customer_email || prompt('Enter email address for test:');
    if (!testTo) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: { type: 'test_email', testTo },
      });
      console.log('Test email result:', JSON.stringify({ data, error }));
      if (error) {
        onToast?.(`Test failed: ${error.message}`, 'error');
        alert(`Test email FAILED:\n${JSON.stringify(error, null, 2)}`);
      } else if (data?.success) {
        onToast?.(`Test email sent to ${testTo}. Resend ID: ${data.resend_response?.id}`, 'success');
        alert(`Test email SUCCESS:\nResend ID: ${data.resend_response?.id}\nFrom: ${data.config?.from_email}\nCheck ${testTo} inbox.`);
      } else {
        onToast?.(`Test failed: ${data?.resend_response?.message || data?.error || 'Unknown error'}`, 'error');
        alert(`Test email FAILED:\n${JSON.stringify(data, null, 2)}`);
      }
    } catch (e) {
      console.error('Test email error:', e);
      onToast?.(`Test failed: ${String(e)}`, 'error');
    }
    setTesting(false);
  }

  const sentDate = quote.token_generated_at
    ? new Date(quote.token_generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const expiresDate = quote.token_expires_at
    ? new Date(quote.token_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const respondedDate = quote.customer_responded_at
    ? new Date(quote.customer_responded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const displayName = quote.customer_name || quote.customer_email || 'customer';

  if (status === 'pending') {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg mb-4">
        <div className="flex items-center gap-2 text-sm text-blue-800">
          <Mail className="w-4 h-4 text-blue-600" />
          <span>Sent to <strong>{quote.customer_email}</strong> on {sentDate}. Expires {expiresDate}.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestEmail}
            disabled={testing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 bg-white border border-amber-300 rounded-md hover:bg-amber-50 transition-colors disabled:opacity-50"
            title="Send a test email to verify Resend API is working"
          >
            <FlaskConical className="w-3 h-3" />
            {testing ? 'Testing...' : 'Test Email'}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={onResend}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Resend
          </button>
        </div>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="flex items-center px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg mb-4">
        <div className="flex items-center gap-2 text-sm text-green-800">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span>Accepted by <strong>{displayName}</strong> on {respondedDate}</span>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg mb-4">
        <div className="flex items-center gap-2 text-sm text-red-800">
          <XCircle className="w-4 h-4 text-red-600" />
          <span>Rejected by <strong>{displayName}</strong> on {respondedDate}.</span>
        </div>
        {onViewResponse && (
          <button
            onClick={onViewResponse}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors"
          >
            View Response
          </button>
        )}
      </div>
    );
  }

  if (status === 'negotiate' || status === 'mixed') {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg mb-4">
        <div className="flex items-center gap-2 text-sm text-blue-800">
          <ArrowLeftRight className="w-4 h-4 text-blue-600" />
          <span>Response received from <strong>{displayName}</strong> on {respondedDate}.</span>
        </div>
        {onViewResponse && (
          <button
            onClick={onViewResponse}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
          >
            View Response
          </button>
        )}
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-4">
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Link expired on {expiresDate}.</span>
        </div>
        <button
          onClick={onResend}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 bg-white border border-amber-300 rounded-md hover:bg-amber-50 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Resend to Customer
        </button>
      </div>
    );
  }

  return null;
}
