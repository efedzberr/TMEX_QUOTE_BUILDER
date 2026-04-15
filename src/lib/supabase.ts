import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Quote {
  id: string;
  quote_number: string;
  quote_name_sequence?: number;
  quote_name_version?: number;
  owner_name: string;
  status: string;
  total_amount: number;
  us_portion: number;
  mx_rate: number;
  border_crossing_fee: number;
  units: string;
  type_of_service: string;
  partner_account: string;
  us_sales_rep: string;
  mx_sales_rep: string;
  currency: string;
  bill_to_customer: string;
  shipper: string;
  bco_partner: string;
  opportunity: string;
  opportunity_type?: string;
  stage?: string;
  rate_type?: string;
  owner_id?: string;
  partner_count?: number;
  exchange_rate?: number;
  cad_exchange_rate?: number;
  us_fuel_difference?: number;
  today_fuel_rate?: number;
  generated_quote_name?: string;
  accessorials_amount?: number;
  accessorials_list?: any;
  accessorials_tab_currency?: string;
  accessorials_tab_language?: string;
  terms_conditions_list?: any;
  terms_tab_currency?: string;
  terms_tab_language?: string;
  review_token?: string;
  token_generated_at?: string;
  token_expires_at?: string;
  customer_review_status?: string;
  customer_responded_at?: string;
  customer_email?: string;
  customer_name?: string;
  customer_title?: string;
  customer_signature_font?: string;
  customer_signature_data?: string;
  lane_acceptance?: Record<string, LaneGroupAcceptance>;
  negotiation_quote_id?: string;
  created_at: string;
  updated_at: string;
}

export interface LaneGroupAcceptance {
  status: 'accepted' | 'rejected' | 'negotiate';
  comment?: string;
  lane_ids: string[];
  responded_at: string;
}

export interface QuoteHistory {
  id: string;
  quote_id: string;
  date: string;
  user_name: string;
  action: string;
  notes: string;
  created_at: string;
}

export interface City {
  id: string;
  city_name: string;
  city_code: string;
  city_full_name: string;
  state_code: string;
  country_code: string;
  market_name: string;
  market_code: string;
  is_border_crossing_city?: boolean;
  created_at: string;
}

export interface QuoteLane {
  id: string;
  quote_id: string;
  origin_city: string;
  destination_city: string;
  border_crossing: string;
  border_crossing_fee: number;
  border_crossing_rate: number;
  us_rate: number;
  mx_rate: number;
  equipment_type: string;
  sort_order: number;
  effective_from_date: string;
  effective_to_date: string;
  additional_accessories: string;
  comments: string;
  commitment_type: string;
  frequency: string;
  fuel_rate_type: string;
  load_frequency: string;
  load_volume: string;
  mx_fuel_rate: number;
  mx_miles: number;
  mx_rate_per_mile: number;
  requested_discount_percent: number;
  requested_price: number;
  un_number: string;
  us_fuel_rate: number;
  us_miles: number;
  us_rate_per_mile: number;
  volume: string;
  msds: boolean | string;
  weight: string | number;
  dimensions: string;
  invoice_value: number;
  temperature: string;
  temperature_unit: string;
  packaging: string;
  units_type: string;
  currency_type: string;
  trip_type?: string;
  linked_lane_id?: string;
  paired_lane_id?: string;
  is_primary_lane?: boolean;
  toll_rate?: number;
  display_mode?: string;
  rate_type?: string;
  us_rate_type?: string;
  mx_rate_type?: string;
  lane_type?: string;
  priority?: string;
  type_of_service?: string;
  target?: string;
  product?: string;
  tarps?: string;
  vin_dimensions?: string;
  number_of_vins?: number;
  live_load_or_drop?: string;
  service_type?: string;
  split_billing_group?: string;
  split_billing_index?: number;
  is_auto_populated?: boolean;
  accessorials_amount?: number;
  accessorials_list?: any;
  currency_code?: string;
  units_code?: string;
  border_crossing_only?: boolean;
  us_fuel_included_in_line_haul?: boolean;
  mx_fuel_included_in_line_haul?: boolean;
  stops_before?: string[];
  stops_after?: string[];
  origin_country_code?: string;
  destination_country_code?: string;
  us_accessorials_list?: any;
  us_accessorials_amount?: number;
  mx_accessorials_list?: any;
  mx_accessorials_amount?: number;
  estimated_total_us_section?: number;
  estimated_total_mx_section?: number;
  us_fuel_difference?: number;
  mx_fuel_difference?: number;
  created_at: string;
  updated_at: string;
}

export async function fetchCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .order('city_name', { ascending: true });

  if (error) {
    console.error('Error fetching cities:', error);
    return [];
  }

  return data || [];
}
