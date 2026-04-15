import { Quote, QuoteLane } from './supabase';
import { normalizeCountryCode } from './constants';

export interface ValidationError {
  field: string;
  label: string;
}

export interface LaneValidationResult {
  laneIndex: number;
  laneId: string;
  serviceType: string;
  tripType: string;
  errors: ValidationError[];
}

export interface CompletedStageValidationResult {
  valid: boolean;
  headerErrors: ValidationError[];
  laneCountError: string | null;
  laneErrors: LaneValidationResult[];
  totalIssues: number;
  lanesWithIssues: number;
}

interface AccountFuelInfo {
  customer_fuel_program: boolean;
  fuel_program_method: string;
}

function getFieldVisibilityForValidation(lane: Partial<QuoteLane>) {
  const serviceType = lane.service_type;
  const borderCrossingOnly = lane.border_crossing_only || false;

  let usFieldsDisabled = false;
  let mxFieldsDisabled = false;
  let borderCrossingDisabled = false;
  let borderFeeDisabled = false;

  if (serviceType === 'Door to Door' && lane.split_billing_group) {
    const sbIdx = lane.split_billing_index || 1;
    const originCC = normalizeCountryCode(lane.origin_country_code);
    const destCC = normalizeCountryCode(lane.destination_country_code);
    const isCrossBorder = originCC && destCC && originCC !== destCC;
    const bothSameNonMX = originCC && destCC && originCC === destCC && originCC !== 'MX';
    const anyMX = originCC === 'MX' || destCC === 'MX';

    const tripType = lane.trip_type;
    const isOneWay = tripType === 'One Way';
    const lane1OriginCC = sbIdx === 1 ? originCC : undefined;

    if (isOneWay && lane1OriginCC) {
      if (sbIdx === 1) {
        if (lane1OriginCC === 'MX') {
          usFieldsDisabled = true;
          mxFieldsDisabled = false;
          borderCrossingDisabled = false;
          borderFeeDisabled = false;
        } else {
          usFieldsDisabled = false;
          mxFieldsDisabled = true;
          borderCrossingDisabled = true;
          borderFeeDisabled = true;
        }
      } else if (sbIdx === 2) {
        if (lane1OriginCC === 'MX') {
          usFieldsDisabled = false;
          mxFieldsDisabled = true;
          borderCrossingDisabled = true;
          borderFeeDisabled = true;
        } else {
          usFieldsDisabled = true;
          mxFieldsDisabled = false;
          borderCrossingDisabled = false;
          borderFeeDisabled = false;
        }
      }
      return { usFieldsDisabled, mxFieldsDisabled, borderCrossingDisabled, borderFeeDisabled };
    }

    if (isCrossBorder) {
      usFieldsDisabled = true;
      mxFieldsDisabled = false;
    } else if (bothSameNonMX) {
      usFieldsDisabled = false;
      mxFieldsDisabled = true;
    } else {
      const knownCC = originCC || destCC;
      usFieldsDisabled = knownCC === 'MX';
      mxFieldsDisabled = !!knownCC && knownCC !== 'MX';
    }
    borderCrossingDisabled = !anyMX;
    borderFeeDisabled = !anyMX;

    return { usFieldsDisabled, mxFieldsDisabled, borderCrossingDisabled, borderFeeDisabled };
  }

  if (serviceType === 'Loop') {
    usFieldsDisabled = true;
    mxFieldsDisabled = false;
    borderCrossingDisabled = false;
    borderFeeDisabled = false;
  } else if (serviceType === 'Domestic') {
    mxFieldsDisabled = true;
    borderCrossingDisabled = true;
    borderFeeDisabled = true;
  }

  if (borderCrossingOnly) {
    mxFieldsDisabled = true;
  }

  return { usFieldsDisabled, mxFieldsDisabled, borderCrossingDisabled, borderFeeDisabled };
}

function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (typeof val === 'number') return false;
  return false;
}

function isZeroOrEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (typeof val === 'number') return val === 0;
  return false;
}

export function validateQuoteHeader(quote: Quote): ValidationError[] {
  const errors: ValidationError[] = [];

  const checks: { field: keyof Quote; label: string }[] = [
    { field: 'partner_account', label: 'Parent Account' },
    { field: 'bill_to_customer', label: 'Bill To Customer' },
    { field: 'shipper', label: 'Shipper' },
    { field: 'bco_partner', label: 'BCO / Partner' },
    { field: 'opportunity_type', label: 'Opportunity Type' },
    { field: 'created_at', label: 'Effective Date' },
    { field: 'mx_sales_rep', label: 'MX Sales Representative' },
    { field: 'owner_name', label: 'Owner / Pricer' },
    { field: 'type_of_service', label: 'Equipment Type' },
    { field: 'currency', label: 'Currency' },
    { field: 'units', label: 'Units' },
  ];

  for (const check of checks) {
    if (isEmpty(quote[check.field])) {
      errors.push({ field: check.field, label: check.label });
    }
  }

  return errors;
}

export function validateLane(
  lane: QuoteLane,
  laneIndex: number,
  accountFuel: AccountFuelInfo,
): LaneValidationResult {
  const errors: ValidationError[] = [];
  const vis = getFieldVisibilityForValidation(lane);
  const isAutoPopulated = lane.is_auto_populated || false;
  const fuelActive = accountFuel.customer_fuel_program;
  const isMethodB = fuelActive && accountFuel.fuel_program_method === 'percentage';

  if (!isAutoPopulated && isEmpty(lane.origin_city)) {
    errors.push({ field: 'origin_city', label: 'Origin City' });
  }
  if (!isAutoPopulated && isEmpty(lane.destination_city)) {
    errors.push({ field: 'destination_city', label: 'Destination City' });
  }

  if (!vis.borderCrossingDisabled) {
    if (isEmpty(lane.border_crossing) || lane.border_crossing === 'N/A') {
      if (lane.service_type !== 'Domestic') {
        errors.push({ field: 'border_crossing', label: 'Border Crossing City' });
      }
    }
  }

  if (!vis.borderFeeDisabled) {
    if (lane.service_type !== 'Domestic') {
      if (isZeroOrEmpty(lane.border_crossing_fee) && isZeroOrEmpty(lane.border_crossing_rate)) {
        errors.push({ field: 'border_crossing_fee', label: 'Border Fee' });
      }
    }
  }

  if (!vis.usFieldsDisabled) {
    const usFuelIncluded = lane.us_fuel_included_in_line_haul || false;
    const usRateType = lane.us_rate_type || 'RPM';

    if (fuelActive) {
      if (isZeroOrEmpty(lane.us_miles)) {
        errors.push({ field: 'us_miles', label: 'US Miles' });
      }
      if (isZeroOrEmpty(lane.us_rate_per_mile)) {
        errors.push({ field: 'us_rate_per_mile', label: 'US Rate Per Mile' });
      }
      if (isMethodB && isZeroOrEmpty(lane.estimated_total_us_section)) {
        errors.push({ field: 'estimated_total_us_section', label: 'Estimated Total US Section' });
      }
    } else {
      if (isZeroOrEmpty(lane.us_miles)) {
        errors.push({ field: 'us_miles', label: 'US Miles' });
      }
      if (!usFuelIncluded && isZeroOrEmpty(lane.us_fuel_rate)) {
        errors.push({ field: 'us_fuel_rate', label: 'US Fuel Rate Per Mile' });
      }
      if (usRateType === 'FLT') {
        if (isZeroOrEmpty(lane.us_rate)) {
          errors.push({ field: 'us_rate', label: 'US Line Haul' });
        }
      } else {
        if (isZeroOrEmpty(lane.us_rate_per_mile)) {
          errors.push({ field: 'us_rate_per_mile', label: 'US Rate Per Mile' });
        }
      }
    }
  }

  if (!vis.mxFieldsDisabled) {
    const mxFuelIncluded = lane.mx_fuel_included_in_line_haul || false;
    const mxRateType = lane.mx_rate_type || 'RPM';

    if (fuelActive) {
      if (isZeroOrEmpty(lane.mx_miles)) {
        errors.push({ field: 'mx_miles', label: 'MX Miles' });
      }
      if (isZeroOrEmpty(lane.mx_rate_per_mile)) {
        errors.push({ field: 'mx_rate_per_mile', label: 'MX Rate Per Mile' });
      }
      if (isMethodB && isZeroOrEmpty(lane.estimated_total_mx_section)) {
        errors.push({ field: 'estimated_total_mx_section', label: 'Estimated Total MX Section' });
      }
    } else {
      if (isZeroOrEmpty(lane.mx_miles)) {
        errors.push({ field: 'mx_miles', label: 'MX Miles' });
      }
      if (!mxFuelIncluded && isZeroOrEmpty(lane.mx_fuel_rate)) {
        errors.push({ field: 'mx_fuel_rate', label: 'MX Fuel Rate Per Mile' });
      }
      if (mxRateType === 'FLT') {
        if (isZeroOrEmpty(lane.mx_rate)) {
          errors.push({ field: 'mx_rate', label: 'MX Line Haul' });
        }
      } else {
        if (isZeroOrEmpty(lane.mx_rate_per_mile)) {
          errors.push({ field: 'mx_rate_per_mile', label: 'MX Rate Per Mile' });
        }
      }
    }
  }

  return {
    laneIndex,
    laneId: lane.id,
    serviceType: lane.service_type || 'Door to Door',
    tripType: lane.trip_type || 'One Way',
    errors,
  };
}

export function validateCompletedStage(
  quote: Quote,
  lanes: QuoteLane[],
  accountFuel: AccountFuelInfo,
): CompletedStageValidationResult {
  const headerErrors = validateQuoteHeader(quote);

  let laneCountError: string | null = null;
  if (lanes.length === 0) {
    laneCountError = 'This quote must have at least one lane before it can be marked as Completed.';
  }

  const laneErrors: LaneValidationResult[] = [];
  for (let i = 0; i < lanes.length; i++) {
    const result = validateLane(lanes[i], i, accountFuel);
    if (result.errors.length > 0) {
      laneErrors.push(result);
    }
  }

  const totalIssues = headerErrors.length + (laneCountError ? 1 : 0) + laneErrors.reduce((sum, l) => sum + l.errors.length, 0);
  const lanesWithIssues = laneErrors.length;

  return {
    valid: totalIssues === 0,
    headerErrors,
    laneCountError,
    laneErrors,
    totalIssues,
    lanesWithIssues,
  };
}
