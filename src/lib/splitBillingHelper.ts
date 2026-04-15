import { QuoteLane } from './supabase';
import { BORDER_CROSSINGS } from './constants';

export interface SplitBillingLanes {
  lane1: Partial<QuoteLane>;
  lane2?: Partial<QuoteLane>;
  lane3?: Partial<QuoteLane>;
  lane4?: Partial<QuoteLane>;
}

export function isBorderCity(city: string | null | undefined): boolean {
  if (!city) return false;
  return BORDER_CROSSINGS.includes(city);
}

export function validateBorderCityField(city: string | null | undefined, fieldName: string): string | null {
  if (!city) return null;
  if (!isBorderCity(city)) {
    return `${fieldName} must be a border crossing city`;
  }
  return null;
}

export function createSplitBillingLanes(
  tripType: 'One Way' | 'Round Trip' | 'Circuit',
  lane1Data: Partial<QuoteLane>,
): SplitBillingLanes {
  if (tripType === 'One Way') {
    return createOneWaySplitBilling(lane1Data);
  } else if (tripType === 'Round Trip') {
    return createRoundTripSplitBilling(lane1Data);
  } else if (tripType === 'Circuit') {
    return createCircuitSplitBilling(lane1Data);
  }
  return { lane1: lane1Data };
}

function createOneWaySplitBilling(lane1Data: Partial<QuoteLane>): SplitBillingLanes {
  // LANE 1 — Mexican Portion
  const lane1: Partial<QuoteLane> = {
    ...lane1Data,
    service_type: 'Loop',
    origin_city: lane1Data.origin_city,
    destination_city: lane1Data.border_crossing,
    border_crossing: lane1Data.border_crossing,
    split_billing_group: 'one-way',
    split_billing_index: 1,
  };

  // LANE 2 — US Portion
  const lane2: Partial<QuoteLane> = {
    service_type: 'Loop',
    trip_type: lane1Data.trip_type,
    rate_type: lane1Data.rate_type || 'FLT',
    origin_city: lane1Data.border_crossing,
    destination_city: lane1Data.destination_city,
    border_crossing: lane1Data.border_crossing,
    split_billing_group: 'one-way',
    split_billing_index: 2,
  };

  return { lane1, lane2 };
}

function createRoundTripSplitBilling(lane1Data: Partial<QuoteLane>): SplitBillingLanes {
  const lane1: Partial<QuoteLane> = {
    ...lane1Data,
    service_type: 'Door to Door',
    origin_city: lane1Data.origin_city,
    destination_city: lane1Data.border_crossing,
    border_crossing: lane1Data.border_crossing,
    split_billing_group: 'round-trip',
    split_billing_index: 1,
  };

  const lane2: Partial<QuoteLane> = {
    service_type: 'Door to Door',
    trip_type: lane1Data.trip_type,
    rate_type: lane1Data.rate_type || 'FLT',
    origin_city: lane1Data.border_crossing,
    destination_city: lane1Data.destination_city,
    border_crossing: lane1Data.border_crossing || '',
    split_billing_group: 'round-trip',
    split_billing_index: 2,
  };

  const lane3: Partial<QuoteLane> = {
    service_type: 'Door to Door',
    trip_type: lane1Data.trip_type,
    rate_type: lane1Data.rate_type || 'FLT',
    origin_city: lane1Data.destination_city,
    destination_city: lane1Data.border_crossing,
    border_crossing: lane1Data.border_crossing || '',
    split_billing_group: 'round-trip',
    split_billing_index: 3,
    is_auto_populated: true,
  };

  const lane4: Partial<QuoteLane> = {
    service_type: 'Door to Door',
    trip_type: lane1Data.trip_type,
    rate_type: lane1Data.rate_type || 'FLT',
    origin_city: lane1Data.border_crossing,
    destination_city: lane1Data.origin_city,
    border_crossing: lane1Data.border_crossing || '',
    split_billing_group: 'round-trip',
    split_billing_index: 4,
    is_auto_populated: true,
  };

  return { lane1, lane2, lane3, lane4 };
}

function createCircuitSplitBilling(lane1Data: Partial<QuoteLane>): SplitBillingLanes {
  // LANE 1 — First MX Portion
  const lane1: Partial<QuoteLane> = {
    ...lane1Data,
    service_type: 'Loop',
    origin_city: lane1Data.origin_city,
    destination_city: lane1Data.destination_city,
    border_crossing: lane1Data.border_crossing,
    split_billing_group: 'circuit',
    split_billing_index: 1,
  };

  // LANE 2 — First US Portion
  const lane2: Partial<QuoteLane> = {
    service_type: 'Loop',
    trip_type: lane1Data.trip_type,
    rate_type: lane1Data.rate_type || 'FLT',
    origin_city: lane1Data.border_crossing,
    destination_city: lane1Data.destination_city,
    border_crossing: lane1Data.border_crossing,
    split_billing_group: 'circuit',
    split_billing_index: 2,
  };

  // LANE 3 — Second US Portion
  const lane3: Partial<QuoteLane> = {
    service_type: 'Loop',
    trip_type: lane1Data.trip_type,
    rate_type: lane1Data.rate_type || 'FLT',
    origin_city: lane1Data.destination_city,
    destination_city: null,
    border_crossing: null,
    split_billing_group: 'circuit',
    split_billing_index: 3,
  };

  // LANE 4 — Second MX Portion (partially auto-populated)
  const lane4: Partial<QuoteLane> = {
    service_type: 'Loop',
    trip_type: lane1Data.trip_type,
    rate_type: lane1Data.rate_type || 'FLT',
    origin_city: null,
    destination_city: lane1Data.origin_city,
    border_crossing: null,
    split_billing_group: 'circuit',
    split_billing_index: 4,
    is_auto_populated: true,
  };

  return { lane1, lane2, lane3, lane4 };
}
