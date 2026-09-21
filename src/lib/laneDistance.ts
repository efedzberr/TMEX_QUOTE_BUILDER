import { supabase } from './supabase';
import type { QuoteLane } from './supabase';

interface CityRef { id: string; country_code: string | null }

export interface LaneMilesResult {
  us_miles: number | null;
  mx_miles: number | null;
  notes: string[];
}

type RouteLike = Pick<QuoteLane, 'origin_city' | 'destination_city' | 'border_crossing' | 'service_type' | 'trip_type' | 'border_crossing_only' | 'split_billing_group'>;

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Stable key of everything that determines the lane's miles. Empty string = route not complete. */
export function routeSignature(l: Partial<RouteLike> | null | undefined): string {
  if (!l) return '';
  const st = l.service_type || '';
  const o = norm(l.origin_city), d = norm(l.destination_city), b = norm(l.border_crossing);
  if (!o || !d) return '';
  const needsCrossing = st !== 'Domestic';
  if (needsCrossing && (!b || b === 'n/a')) return '';
  return [st, o, d, needsCrossing ? b : '', l.border_crossing_only ? 'bco' : ''].join('|');
}

async function resolveCity(cityText: string | null | undefined): Promise<CityRef | null> {
  const text = (cityText ?? '').trim();
  if (!text || text.toUpperCase() === 'N/A') return null;
  const { data, error } = await supabase
    .from('cities')
    .select('id, country_code')
    .ilike('city_full_name', text)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as CityRef;
}

async function getLegMiles(fromId: string, toId: string): Promise<number | null> {
  if (fromId === toId) return 0;
  const { data, error } = await supabase.functions.invoke('get-lane-distance', {
    body: { city_id: fromId, border_crossing_city_id: toId },
  });
  if (error) { console.error('get-lane-distance error:', error); return null; }
  if (!data?.ok) { console.warn('get-lane-distance not-ok:', data?.error); return null; }
  return Number(data.distance_miles);
}

const isMX = (c: CityRef | null) => (c?.country_code || '').toUpperCase().startsWith('MEX');
const isUS = (c: CityRef | null) => (c?.country_code || '').toUpperCase().startsWith('US');

/**
 * Computes the miles that apply to the lane according to its service type.
 * Returns null fields for legs that do not apply or could not be resolved.
 */
export async function computeLaneMiles(l: Partial<RouteLike>): Promise<LaneMilesResult> {
  const result: LaneMilesResult = { us_miles: null, mx_miles: null, notes: [] };
  const st = l.service_type || '';
  const [origin, destination] = await Promise.all([resolveCity(l.origin_city), resolveCity(l.destination_city)]);
  if (!origin) result.notes.push(`Origin "${l.origin_city ?? ''}" not found in cities.`);
  if (!destination) result.notes.push(`Destination "${l.destination_city ?? ''}" not found in cities.`);

  if (st === 'Domestic') {
    if (origin && destination) {
      const m = await getLegMiles(origin.id, destination.id);
      if (m == null) result.notes.push('Distance could not be calculated; enter the miles manually.');
      else result.us_miles = m;
    }
    return result;
  }

  const crossing = await resolveCity(l.border_crossing);
  if (!crossing) { result.notes.push('Border crossing not found in cities; miles not filled.'); return result; }

  const legFor = async (city: CityRef | null): Promise<number | null> => {
    if (!city || city.id === crossing.id) return null;
    return getLegMiles(city.id, crossing.id);
  };

  if (st === 'Loop') {
    const mxCity = isMX(origin) ? origin : isMX(destination) ? destination : null;
    const m = await legFor(mxCity);
    if (m != null) result.mx_miles = m; else result.notes.push('MX distance could not be calculated; enter the miles manually.');
    return result;
  }

  if (l.border_crossing_only) {
    const usCity = isUS(origin) ? origin : isUS(destination) ? destination : null;
    const m = await legFor(usCity);
    if (m != null) result.us_miles = m; else result.notes.push('US distance could not be calculated; enter the miles manually.');
    return result;
  }

  // Door to Door (one way, round trip, circuit, split billing)
  for (const city of [origin, destination]) {
    if (!city || city.id === crossing.id) continue;
    const m = await legFor(city);
    if (m == null) { result.notes.push('A leg could not be calculated; enter the miles manually.'); continue; }
    if (isMX(city)) result.mx_miles = m;
    else if (isUS(city)) result.us_miles = m;
  }
  return result;
}

/** Backwards-compatible wrapper (Door to Door semantics). */
export async function fillLaneMiles(originText: string, destinationText: string, crossingText: string): Promise<LaneMilesResult> {
  return computeLaneMiles({ origin_city: originText, destination_city: destinationText, border_crossing: crossingText, service_type: 'Door to Door' });
}
