import { useState, useEffect, useMemo } from 'react';
import { X, Send, ExternalLink, Mail, Clock, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { Quote, QuoteLane } from '../../lib/supabase';
import { buildLaneAcceptanceGroups, generateReviewToken, getPortalUrl, getPreviewUrl, formatGroupTotal, LaneAcceptanceGroup } from '../../lib/customerPortalHelpers';
import { supabase } from '../../lib/supabase';

interface Props {
  quote: Quote;
  lanes: QuoteLane[];
  pdfGenerated: boolean;
  isResend?: boolean;
  expiredDate?: string;
  onClose: () => void;
  onSuccess: (updatedQuote: Partial<Quote>, portalUrl: string, emailSuccess: boolean) => void;
}

export function PdfSendToCustomerModal({ quote, lanes, pdfGenerated, isResend, expiredDate, onClose, onSuccess }: Props) {
  const [customerEmail, setCustomerEmail] = useState(quote.customer_email || '');
  const [customerName, setCustomerName] = useState(quote.customer_name || '');
  const [expirationDays, setExpirationDays] = useState(30);
  const [personalMessage, setPersonalMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailFormatError, setEmailFormatError] = useState('');
  const [loadingDefaults, setLoadingDefaults] = useState(true);

  const groups = useMemo(() => buildLaneAcceptanceGroups(lanes), [lanes]);

  useEffect(() => {
    loadDefaultExpiration();
  }, []);

  async function loadDefaultExpiration() {
    setLoadingDefaults(true);
    const { data } = await supabase
      .from('global_variables')
      .select('quote_link_expiration_days')
      .limit(1)
      .maybeSingle();
    if (data?.quote_link_expiration_days) {
      setExpirationDays(data.quote_link_expiration_days);
    }
    setLoadingDefaults(false);
  }

  const expiryDate = useMemo(() => {
    const d = new Date(Date.now() + expirationDays * 86400000);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [expirationDays]);

  function validate(): boolean {
    let valid = true;
    setEmailError('');
    setEmailFormatError('');

    if (!customerEmail.trim()) {
      setEmailError('Customer email is required');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setEmailFormatError('Please enter a valid email address');
      valid = false;
    }

    if (lanes.length === 0) {
      valid = false;
    }

    const stageOrder = ['Completed', 'Sent to Customer', 'Customer Responded'];
    const currentStage = quote.stage || '';
    if (!stageOrder.some(s => currentStage.includes(s)) && currentStage !== 'Sent to Customer') {
      if (currentStage !== 'Completed' && currentStage !== 'Sent to Customer' && currentStage !== 'Customer Responded') {
        // Allow sending at Completed or higher stages
      }
    }

    return valid;
  }

  async function handleSend() {
    if (!validate()) return;

    setSending(true);

    const token = generateReviewToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationDays * 86400000);

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
      setEmailError(`Failed to save: ${error.message}`);
      setSending(false);
      return;
    }

    await supabase.from('quote_history').insert({
      quote_id: quote.id,
      date: now.toISOString(),
      user_name: quote.owner_name,
      action: isResend ? 'Resent to Customer' : 'Sent to Customer',
      notes: `Quote ${isResend ? 'resent' : 'sent'} to ${customerEmail.trim()}. Token expires ${expiresAt.toLocaleDateString()}.`,
    });

    const portalUrl = getPortalUrl(token);

    let emailSuccess = true;
    let emailErrorDetail = '';
    try {
      const { data: emailData, error: emailErr } = await supabase.functions.invoke('send-quote-email', {
        body: {
          type: 'send_to_customer',
          quoteId: quote.id,
          customerEmail: customerEmail.trim(),
          customerName: customerName.trim() || undefined,
          personalMessage: personalMessage.trim() || undefined,
        },
      });
      console.log('Full Edge Function response:', JSON.stringify({ data: emailData, error: emailErr }));
      if (emailErr) {
        console.error('Edge function invocation error:', emailErr);
        emailSuccess = false;
        emailErrorDetail = emailErr.message || 'Edge function invocation failed';
      } else if (emailData?.error) {
        console.error('Email delivery error:', emailData.error, emailData.details);
        emailSuccess = false;
        emailErrorDetail = `${emailData.error}${emailData.details ? ': ' + JSON.stringify(emailData.details) : ''}`;
      } else if (emailData?.success) {
        console.log('Email sent successfully, Resend ID:', emailData.emailId);
      }
    } catch (e) {
      console.error('Email invocation failed:', e);
      emailSuccess = false;
      emailErrorDetail = String(e);
    }

    if (emailErrorDetail) {
      console.error('Email error detail for toast:', emailErrorDetail);
    }

    setSending(false);
    onSuccess(updates, portalUrl, emailSuccess);
  }

  function handlePreview() {
    window.open(getPreviewUrl(quote.id), '_blank');
  }

  if (loadingDefaults) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-[600px] p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
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
          {pdfGenerated && (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">PDF has been generated and downloaded.</p>
                <p className="text-green-700 mt-0.5">You can now send the quote portal link to your customer.</p>
              </div>
            </div>
          )}

          {isResend && expiredDate && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                The previous link expired on {new Date(expiredDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. A new link will be generated.
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold mb-0.5">Quote Number</div>
                <div className="font-medium text-gray-900">{quote.generated_quote_name || quote.quote_number}</div>
              </div>
              <div>
                <div className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold mb-0.5">Customer</div>
                <div className="font-medium text-gray-900">{quote.partner_account || '--'}</div>
              </div>
              <div>
                <div className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold mb-0.5">Lane Groups</div>
                <div className="font-medium text-gray-900">{groups.length}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                <Mail className="w-3.5 h-3.5 inline mr-1" />
                Customer Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={e => { setCustomerEmail(e.target.value); setEmailError(''); setEmailFormatError(''); }}
                placeholder="customer@company.com"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${emailError || emailFormatError ? 'border-red-400' : 'border-gray-300'}`}
              />
              {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
              {emailFormatError && <p className="text-xs text-red-600 mt-1">{emailFormatError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer contact name"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Link Expiration
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={90}
                value={expirationDays}
                onChange={e => setExpirationDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))}
                className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-600">days</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">The customer will have {expirationDays} days to review and respond</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Personal Message (optional)
            </label>
            <textarea
              value={personalMessage}
              onChange={e => setPersonalMessage(e.target.value.slice(0, 500))}
              placeholder="Add a personal note to include with the quote email..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{personalMessage.length}/500</p>
          </div>

          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              The customer portal link will expire on <strong>{expiryDate}</strong>. After this date the link will no longer work.
            </div>
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
            <div className="space-y-2 max-h-36 overflow-y-auto">
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
            Preview Portal
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
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
