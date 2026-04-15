import { useState } from 'react';
import { X, Send, ExternalLink, Mail, Clock, Users } from 'lucide-react';
import { Quote, QuoteLane } from '../lib/supabase';
import { buildLaneAcceptanceGroups, generateReviewToken, getPortalUrl, getPreviewUrl, formatGroupTotal, LaneAcceptanceGroup } from '../lib/customerPortalHelpers';
import { supabase } from '../lib/supabase';

interface SendToCustomerModalProps {
  quote: Quote;
  lanes: QuoteLane[];
  onClose: () => void;
  onSuccess: (updatedQuote: Partial<Quote>, portalUrl: string) => void;
}

export function SendToCustomerModal({ quote, lanes, onClose, onSuccess }: SendToCustomerModalProps) {
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState(quote.customer_name || '');
  const [expirationDays, setExpirationDays] = useState(30);
  const [personalMessage, setPersonalMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const groups = buildLaneAcceptanceGroups(lanes);

  function validate(): string[] {
    const issues: string[] = [];
    if (!customerEmail.trim()) issues.push('Customer Email is required');
    if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      issues.push('Please enter a valid email address');
    }
    if (lanes.length === 0) issues.push('Quote has no lanes');
    if (!quote.partner_account) issues.push('Partner Account is missing');
    if (quote.customer_review_status === 'accepted') issues.push('Cannot resend an already accepted quote');
    if (expirationDays < 1 || expirationDays > 365) issues.push('Expiration must be between 1 and 365 days');
    return issues;
  }

  async function handleSend() {
    const issues = validate();
    if (issues.length > 0) {
      setErrors(issues);
      return;
    }

    setSending(true);
    setErrors([]);

    const token = generateReviewToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);

    const updates: Partial<Quote> = {
      review_token: token,
      token_generated_at: now.toISOString(),
      token_expires_at: expiresAt.toISOString(),
      customer_review_status: 'pending',
      customer_name: customerName.trim() || undefined,
      customer_email: customerEmail.trim(),
      stage: 'Sent to Customer',
    };

    const { error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', quote.id);

    if (error) {
      setErrors([`Failed to save: ${error.message}`]);
      setSending(false);
      return;
    }

    await supabase.from('quote_history').insert({
      quote_id: quote.id,
      date: now.toISOString(),
      user_name: quote.owner_name,
      action: 'Sent to Customer',
      notes: `Quote sent to ${customerEmail.trim()}. Token expires ${expiresAt.toLocaleDateString()}.`,
    });

    const portalUrl = getPortalUrl(token);

    supabase.functions.invoke('send-quote-email', {
      body: {
        type: 'send_to_customer',
        quoteId: quote.id,
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim() || undefined,
        personalMessage: personalMessage.trim() || undefined,
      },
    }).then(({ data, error: emailError }) => {
      console.log('Full Edge Function response:', JSON.stringify({ data, error: emailError }));
      if (emailError) {
        console.error('Edge function invocation error:', emailError);
      } else if (data?.error) {
        console.error('Email delivery error:', data.error, data.details);
      } else if (data?.success) {
        console.log('Email sent successfully, Resend ID:', data.emailId);
      }
    }).catch((e) => {
      console.error('Email invocation failed:', e);
    });

    try {
      await navigator.clipboard.writeText(portalUrl);
    } catch {
    }

    setSending(false);
    onSuccess(updates, portalUrl);
  }

  function handlePreview() {
    window.open(getPreviewUrl(quote.id), '_blank');
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Send Quote to Customer</h2>
              <p className="text-xs text-gray-500">{quote.generated_quote_name || quote.quote_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                <Mail className="w-3.5 h-3.5 inline mr-1" />
                Customer Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="customer@company.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Days Until Link Expires
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={expirationDays}
              onChange={e => setExpirationDays(parseInt(e.target.value) || 30)}
              className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Personal Message (Optional)
            </label>
            <textarea
              value={personalMessage}
              onChange={e => setPersonalMessage(e.target.value)}
              placeholder="Add a personal note to include with the quote..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Lane Groups Preview
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              The customer will review {groups.length} lane group{groups.length !== 1 ? 's' : ''} and respond Accept / Reject / Negotiate per group:
            </p>
            <div className="space-y-2">
              {groups.map(group => (
                <GroupPreviewRow key={group.group_id} group={group} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={handlePreview}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Preview
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send to Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupPreviewRow({ group }: { group: LaneAcceptanceGroup }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-gray-100">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-800">{group.label}</div>
        <div className="text-[10px] text-gray-500 truncate">
          {group.origin} → {group.destination}
          {group.border_crossing && group.border_crossing !== 'N/A' && ` via ${group.border_crossing}`}
        </div>
      </div>
      <div className="text-xs font-bold text-gray-900 ml-3 whitespace-nowrap">
        {formatGroupTotal(group.lane_total, group.currency_code)}
      </div>
    </div>
  );
}
