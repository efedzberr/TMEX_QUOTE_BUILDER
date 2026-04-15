import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, Quote, QuoteLane } from '../../lib/supabase';
import { LoadingState, TokenNotFoundState } from './PortalStates';
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

export function CustomerReviewPreview() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lanes, setLanes] = useState<QuoteLane[]>([]);

  console.log('=== CustomerReviewPreview mounted ===');
  console.log('quoteId from useParams:', quoteId);
  console.log('Full URL:', window.location.href);
  console.log('Hash:', window.location.hash);

  useEffect(() => {
    if (quoteId) {
      loadQuote();
    }
  }, [quoteId]);

  async function loadQuote() {
    setLoading(true);

    console.log('Preview querying for quote id:', quoteId);

    const { data: quoteData, error } = await supabase
      .from('quotes')
      .select(QUOTE_SAFE_FIELDS)
      .eq('id', quoteId)
      .maybeSingle();

    console.log('Preview query result:', { quote: quoteData, error });

    if (error || !quoteData) {
      console.error('Preview query failed - error:', error, 'data:', quoteData);
      setLoading(false);
      return;
    }

    const { data: lanesData } = await supabase
      .from('quote_lanes')
      .select(LANE_SAFE_FIELDS)
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });

    setQuote(quoteData as unknown as Quote);
    setLanes((lanesData || []) as unknown as unknown as QuoteLane[]);
    setLoading(false);
  }

  if (loading) return <LoadingState />;
  if (!quote) return <TokenNotFoundState />;

  return <PortalPageShell quote={quote} lanes={lanes} isPreview />;
}
