import { AlertTriangle, Clock, CheckCircle, Info, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Quote, QuoteLane } from '../../lib/supabase';
import { buildLaneAcceptanceGroups } from '../../lib/customerPortalHelpers';

function PortalCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src="/Transmex_Logo_II.jpeg" alt="TransMex" className="h-12 object-contain" />
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {children}
        </div>
        <p className="text-xs text-gray-400 text-center mt-6">
          TransMex Smart Pricing Hub -- Confidential
        </p>
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <img src="/Transmex_Logo_II.jpeg" alt="TransMex" className="h-14 object-contain mb-6" />
      <div className="w-8 h-8 border-3 border-gray-200 border-t-teal-600 rounded-full animate-spin mb-4" />
      <p className="text-sm text-gray-500">Loading your quote...</p>
    </div>
  );
}

export function TokenNotFoundState() {
  return (
    <PortalCard>
      <div className="p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Quote Not Found</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          This quote link is not valid or has been removed. Please contact your TransMex representative for assistance.
        </p>
      </div>
    </PortalCard>
  );
}

export function TokenExpiredState({ expiresAt }: { expiresAt?: string }) {
  const formattedDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'an unknown date';

  return (
    <PortalCard>
      <div className="p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">This Quote Has Expired</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          This quote link expired on {formattedDate}. Please contact your TransMex representative to request an updated quote.
        </p>
      </div>
    </PortalCard>
  );
}

interface ResponseSummaryProps {
  quote: Quote;
  lanes: QuoteLane[];
}

function ResponseSummary({ quote, lanes }: ResponseSummaryProps) {
  const groups = buildLaneAcceptanceGroups(lanes);
  const acceptance = quote.lane_acceptance || {};

  return (
    <div className="space-y-2 mt-4">
      {groups.map(group => {
        const response = acceptance[`group_${group.group_id}`] || acceptance[group.group_id];
        const status = response?.status;

        return (
          <div key={group.group_id} className="flex items-center gap-2 text-sm">
            {status === 'accepted' && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
            {status === 'rejected' && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
            {status === 'negotiate' && <RotateCcw className="w-4 h-4 text-blue-600 flex-shrink-0" />}
            {!status && <div className="w-4 h-4 rounded-full bg-gray-200 flex-shrink-0" />}
            <span className="text-gray-700">{group.label}</span>
            <span className="text-xs ml-auto font-medium" style={{
              color: status === 'accepted' ? '#15803d' : status === 'rejected' ? '#b91c1c' : status === 'negotiate' ? '#1d4ed8' : '#9ca3af'
            }}>
              {status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Rejected' : status === 'negotiate' ? 'Negotiating' : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AlreadyAcceptedState({ quote, lanes }: ResponseSummaryProps) {
  const formatDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <PortalCard>
      <div className="border-l-4 border-green-500 p-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Quote Already Accepted</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed mb-1">
          Thank you{quote.customer_name ? `, ${quote.customer_name}` : ''}.
        </p>
        <p className="text-sm text-gray-500">
          You submitted your response on {formatDate(quote.customer_responded_at)}.
          Your TransMex representative has been notified.
        </p>
        <ResponseSummary quote={quote} lanes={lanes} />
      </div>
    </PortalCard>
  );
}

export function AlreadyRespondedState({ quote, lanes }: ResponseSummaryProps) {
  const formatDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <PortalCard>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <Info className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Response Already Submitted</h2>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          You submitted your response on {formatDate(quote.customer_responded_at)}.
          Your TransMex representative will be in touch shortly.
        </p>
        <ResponseSummary quote={quote} lanes={lanes} />
      </div>
    </PortalCard>
  );
}
