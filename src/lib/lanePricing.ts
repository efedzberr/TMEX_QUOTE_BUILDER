import { supabase } from './supabase';
import type { Quote, QuoteLane } from './supabase';

export interface AccountFuelProgram {
  customer_fuel_program: boolean;
  fuel_program_type: string;
  fuel_program_method: string; // 'per_mile' | 'percentage'
  fuel_rate_per_mile: number;
}

export const NO_FUEL_PROGRAM: AccountFuelProgram = { customer_fuel_program: false, fuel_program_type: 'FRPM', fuel_program_method: 'per_mile', fuel_rate_per_mile: 0 };

export async function fetchAccountFuelProgram(partnerAccountName: string | null | undefined): Promise<AccountFuelProgram> {
  const name = (partnerAccountName ?? '').trim();
  if (!name) return NO_FUEL_PROGRAM;
  const { data } = await supabase
    .from('accounts')
    .select('customer_fuel_program, fuel_program_type, fuel_rate_per_mile, fuel_program_method')
    .eq('account_name', name)
    .maybeSingle();
  if (!data) return NO_FUEL_PROGRAM;
  return {
    customer_fuel_program: !!data.customer_fuel_program,
    fuel_program_type: data.fuel_program_type || 'FRPM',
    fuel_program_method: data.fuel_program_method || 'per_mile',
    fuel_rate_per_mile: Number(data.fuel_rate_per_mile) || 0,
  };
}

export const isPercentProgram = (a: AccountFuelProgram) =>
  a.customer_fuel_program && (a.fuel_program_method === 'percentage' || a.fuel_program_type === 'PERCENT');
export const isPerMileProgram = (a: AccountFuelProgram) => a.customer_fuel_program && !isPercentProgram(a);

export interface PricingContext { quote: Quote | undefined; account: AccountFuelProgram }

/** Which sections apply to a lane, by service type and flags. */
export function laneSections(l: Partial<QuoteLane>): { us: boolean; mx: boolean } {
  const st = l.service_type || '';
  if (st === 'Domestic') return { us: true, mx: false };
  if (st === 'Loop') return { us: false, mx: true };
  if (l.border_crossing_only) return { us: true, mx: false };
  return { us: true, mx: true };
}

export interface PricingNotes { notes: string[] }

/**
 * Applies the pricing defaults for a lane whose route just changed:
 * rate per mile from the quote, fuel from the account program (or the quote), RPM when a program
 * is active, line haul recomputed, fuel differences recomputed. Returns a new object.
 */
export function applyPricingDefaults(l: Partial<QuoteLane>, ctx: PricingContext): { lane: Partial<QuoteLane>; notes: string[] } {
  const next: Partial<QuoteLane> = { ...l };
  const notes: string[] = [];
  const rpm = Number(ctx.quote?.rate_per_mile) || 0;
  const todayFuel = Number(ctx.quote?.today_fuel_rate) || 0;
  const acc = ctx.account;
  const program = acc.customer_fuel_program;
  const percent = isPercentProgram(acc);
  const sections = laneSections(next);
  const isSB = !!next.split_billing_group;

  if (program) {
    next.rate_type = 'RPM';
    next.us_rate_type = 'RPM';
    next.mx_rate_type = 'RPM';
  }

  const applySection = (side: 'us' | 'mx') => {
    const milesKey = `${side}_miles` as const;
    const rpmKey = `${side}_rate_per_mile` as const;
    const rateKey = `${side}_rate` as const;
    const fuelKey = `${side}_fuel_rate` as const;
    const diffKey = `${side}_fuel_difference` as const;
    const rtKey = `${side}_rate_type` as const;

    if (rpm > 0) next[rpmKey] = rpm;

    let effectiveFuel: number | null = null;
    if (!program) {
      if (todayFuel > 0) next[fuelKey] = todayFuel;
      effectiveFuel = next[fuelKey] || 0;
      next[diffKey] = 0;
    } else if (percent) {
      effectiveFuel = null; // needs Estimated Total Section, entered in the lane details
    } else {
      next[fuelKey] = acc.fuel_rate_per_mile;
      effectiveFuel = acc.fuel_rate_per_mile;
    }

    if (program && effectiveFuel != null) {
      next[diffKey] = effectiveFuel < todayFuel ? Math.round((todayFuel - effectiveFuel) * 10000) / 10000 : 0;
    }

    const rt = isSB ? (next[rtKey] || next.rate_type || 'RPM') : (next.rate_type || 'RPM');
    const miles = Number(next[milesKey]) || 0;
    if (rt === 'RPM') {
      next[rateKey] = Math.round(miles * (Number(next[rpmKey]) || 0) * 100) / 100;
    } else if ((rt === 'FLT' || rt === 'Flat Rate') && miles > 0) {
      next[rpmKey] = Math.round(((Number(next[rateKey]) || 0) / miles) * 10000) / 10000;
    }
  };

  if (sections.us) applySection('us');
  if (sections.mx) applySection('mx');

  if (percent) notes.push('This account has a percentage fuel program: open the lane details to enter the Estimated Total Section so the fuel can be calculated.');
  if (program && todayFuel <= 0) notes.push("Today's Fuel Rate is not set on the quote; fuel differences cannot be calculated.");
  return { lane: next, notes };
}
