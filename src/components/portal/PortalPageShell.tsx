import { Quote, QuoteLane } from '../../lib/supabase';
import { PortalContent } from './PortalContent';

interface PortalPageShellProps {
  quote: Quote;
  lanes: QuoteLane[];
  isPreview?: boolean;
  children?: React.ReactNode;
}

export function PortalPageShell({ quote, lanes, isPreview = false, children }: PortalPageShellProps) {
  const expiresDate = quote.token_expires_at
    ? new Date(quote.token_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const isPending = quote.customer_review_status === 'pending' || !quote.customer_responded_at;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {isPreview && (
        <div className="bg-teal-800 text-white px-4 py-2.5 text-center">
          <div className="max-w-[1100px] mx-auto flex items-center justify-center gap-2">
            <span className="text-sm font-medium">
              INTERNAL PREVIEW — This is how the customer will see this quote. This page is not yet sent to the customer.
            </span>
          </div>
        </div>
      )}

      <header className="bg-white border-b-2 border-blue-500 shadow-sm">
        <div className="max-w-[1100px] mx-auto px-6 py-3 flex items-center justify-between">
          <img src="/Transmex_Logo_II.jpeg" alt="TransMex" className="h-9 object-contain" />
          <span className="text-sm text-gray-400 font-medium">Quote Review</span>
          <span className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
            {quote.generated_quote_name || quote.quote_number}
          </span>
        </div>
      </header>

      {isPending && !isPreview && expiresDate && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-[1100px] mx-auto px-6 py-2.5">
            <p className="text-xs text-blue-700">
              Please review each lane below and indicate your response. Your link expires on {expiresDate}.
            </p>
          </div>
        </div>
      )}

      <main className="flex-1">
        <div className="max-w-[1100px] mx-auto px-6 py-6">
          {children || (
            <PortalContent quote={quote} lanes={lanes} isPreview={isPreview} />
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-[1100px] mx-auto px-6 py-4">
          <p className="text-xs text-gray-400 text-center">
            TransMex Smart Pricing Hub — Confidential Quote for {quote.partner_account || 'Customer'}
          </p>
        </div>
      </footer>
    </div>
  );
}
