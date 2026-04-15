import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, Quote, QuoteLane } from '../../lib/supabase';
import { LoadingState, TokenNotFoundState, TokenExpiredState, AlreadyAcceptedState, AlreadyRespondedState } from './PortalStates';
import { PortalPageShell } from './PortalPageShell';

const QUOTE_SAFE_FIELDS = `
  id, quote_number, partner_account, bill_to_customer,
  shipper, bco_partner, owner_name, mx_sales_rep, us_sales_rep,
  type_of_service, currency, units,
  review_token, token_expires_at, customer_review_status,
  customer_responded_at, customer_name, customer_title, lane_acceptance,
  negotiation_quote_id, generated_quote_name, exchange_rate, today_fuel_rate, stage,
  accessorials_list, accessorials_amount,
  terms_conditions_list, created_at
`;

const LANE_SAFE_FIELDS = `
  id, quote_id, origin_city, destination_city, border_crossing,
  border_crossing_fee, service_type, trip_type,
  split_billing_group, split_billing_index, is_primary_lane,
  paired_lane_id, linked_lane_id, sort_order, equipment_type,
  currency_code, units_code, stops_before, stops_after,
  lane_type, load_volume, load_frequency, commitment_type,
  comments, accessorials_amount,
  us_accessorials_list, mx_accessorials_list, accessorials_list,
  us_rate, mx_rate, toll_rate
`;

type PortalState = 'loading' | 'not_found' | 'expired' | 'accepted' | 'responded' | 'active';

export function CustomerReviewPortal() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PortalState>('loading');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lanes, setLanes] = useState<QuoteLane[]>([]);

  console.log('=== CustomerReviewPortal mounted ===');
  console.log('Token from useParams:', token);
  console.log('Full URL:', window.location.href);
  console.log('Hash:', window.location.hash);

  useEffect(() => {
    if (token) {
      loadQuoteByToken();
    } else {
      setState('not_found');
    }
  }, [token]);

  async function loadQuoteByToken() {
    setState('loading');

    console.log('Querying for review_token:', token);

    const { data: quoteData, error } = await supabase
      .from('quotes')
      .select(QUOTE_SAFE_FIELDS)
      .eq('review_token', token)
      .maybeSingle();

    console.log('Supabase query result:', { quote: quoteData, error });

    if (error || !quoteData) {
      console.error('Portal query failed - error:', error, 'data:', quoteData);
      setState('not_found');
      return;
    }

    const now = new Date();
    const expiresAt = quoteData.token_expires_at ? new Date(quoteData.token_expires_at) : null;

    if (expiresAt && expiresAt < now && !quoteData.customer_responded_at) {
      setQuote(quoteData as unknown as Quote);
      setState('expired');
      return;
    }

    if (quoteData.customer_responded_at) {
      const status = quoteData.customer_review_status;
      setQuote(quoteData as unknown as Quote);

      const { data: lanesData } = await supabase
        .from('quote_lanes')
        .select(LANE_SAFE_FIELDS)
        .eq('quote_id', quoteData.id)
        .order('sort_order', { ascending: true });

      setLanes((lanesData || []) as unknown as unknown as QuoteLane[]);

      if (status === 'accepted') {
        setState('accepted');
      } else {
        setState('responded');
      }
      return;
    }

    const { data: lanesData } = await supabase
      .from('quote_lanes')
      .select(LANE_SAFE_FIELDS)
      .eq('quote_id', quoteData.id)
      .order('sort_order', { ascending: true });

    setQuote(quoteData as unknown as Quote);
    setLanes((lanesData || []) as unknown as unknown as QuoteLane[]);
    setState('active');
  }

  if (state === 'loading') return <LoadingState />;
  if (state === 'not_found') return <TokenNotFoundState />;
  if (state === 'expired' && quote) return <TokenExpiredState expiresAt={quote.token_expires_at} />;
  if (state === 'accepted' && quote) return <AlreadyAcceptedState quote={quote} lanes={lanes} />;
  if (state === 'responded' && quote) return <AlreadyRespondedState quote={quote} lanes={lanes} />;

  if (state === 'active' && quote) {
    return <PortalPageShell quote={quote} lanes={lanes} />;
  }

  return <LoadingState />;
}
