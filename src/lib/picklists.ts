import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import {
  EQUIPMENT_TYPES, LANE_TYPES, LOAD_FREQUENCIES, COMMITMENT_TYPES, LIVE_LOAD_OPTIONS, PRIORITIES,
  MX_SALES_REPRESENTATIVES, US_SALES_REPRESENTATIVES,
  TRIP_TYPES, RATE_TYPES, STAGES, OPPORTUNITY_TYPES, QUOTE_PRIORITIES, CURRENCIES,
} from './constants';

/** Global lists an administrator can extend (Administration → Global Picklists). */
export type PicklistKey =
  | 'equipment_type' | 'lane_type' | 'load_frequency' | 'commitment_type'
  | 'live_load_or_drop' | 'lane_priority' | 'mx_sales_rep' | 'us_sales_rep';

/** Lists whose values drive business rules; shown for reference only. */
export type SystemPicklistKey = 'service_type' | 'trip_type' | 'rate_type' | 'stage' | 'opportunity_type' | 'quote_priority' | 'currency';

export interface PicklistValue {
  id: string;
  picklist_key: PicklistKey;
  value: string;
  sort_order: number;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
}

export interface PicklistDef {
  key: PicklistKey | SystemPicklistKey;
  label: string;
  /** where the list is used, for the administrator's reference */
  usedBy: string;
  editable: boolean;
  /** built-in values: fallback while the database values load, and the full content of system lists */
  builtIn: readonly string[];
}

export const PICKLIST_DEFS: PicklistDef[] = [
  { key: 'equipment_type', label: 'Equipment Type', usedBy: 'Quotes, Quote Lanes, Accessorials, Terms & Conditions', editable: true, builtIn: EQUIPMENT_TYPES },
  { key: 'mx_sales_rep', label: 'MX Sales Rep', usedBy: 'Quotes', editable: true, builtIn: MX_SALES_REPRESENTATIVES },
  { key: 'us_sales_rep', label: 'US Sales Rep', usedBy: 'Quotes', editable: true, builtIn: US_SALES_REPRESENTATIVES },
  { key: 'lane_type', label: 'Lane Type', usedBy: 'Quote Lanes', editable: true, builtIn: LANE_TYPES },
  { key: 'load_frequency', label: 'Load Frequency', usedBy: 'Quote Lanes', editable: true, builtIn: LOAD_FREQUENCIES },
  { key: 'commitment_type', label: 'Commitment Type', usedBy: 'Quote Lanes', editable: true, builtIn: COMMITMENT_TYPES },
  { key: 'live_load_or_drop', label: 'Live Load or Drop', usedBy: 'Quote Lanes', editable: true, builtIn: LIVE_LOAD_OPTIONS },
  { key: 'lane_priority', label: 'Lane Priority', usedBy: 'Quote Lanes', editable: true, builtIn: PRIORITIES },
  { key: 'service_type', label: 'Service Type', usedBy: 'Quote Lanes', editable: false, builtIn: ['Door to Door', 'Loop', 'Domestic'] },
  { key: 'trip_type', label: 'Trip Type', usedBy: 'Quote Lanes', editable: false, builtIn: TRIP_TYPES },
  { key: 'rate_type', label: 'Rate Type', usedBy: 'Quote Lanes', editable: false, builtIn: RATE_TYPES },
  { key: 'stage', label: 'Stage', usedBy: 'Quotes', editable: false, builtIn: STAGES },
  { key: 'opportunity_type', label: 'Opportunity Type', usedBy: 'Quotes, SLA', editable: false, builtIn: OPPORTUNITY_TYPES },
  { key: 'quote_priority', label: 'Priority', usedBy: 'Quotes, SLA', editable: false, builtIn: QUOTE_PRIORITIES },
  { key: 'currency', label: 'Currency', usedBy: 'Quotes, Quote Lanes', editable: false, builtIn: CURRENCIES },
];

export function picklistDef(key: string): PicklistDef | undefined {
  return PICKLIST_DEFS.find(d => d.key === key);
}

/** Objects & Fields: which global list backs each field ("objectId.column"). */
const FIELD_PICKLISTS: Record<string, PicklistDef['key']> = {
  'quotes_object.type_of_service': 'equipment_type',
  'quotes_object.mx_sales_rep': 'mx_sales_rep',
  'quotes_object.us_sales_rep': 'us_sales_rep',
  'quotes_object.stage': 'stage',
  'quotes_object.opportunity_type': 'opportunity_type',
  'quotes_object.priority': 'quote_priority',
  'quotes_object.currency': 'currency',
  'quote_lanes_object.equipment_type': 'equipment_type',
  'quote_lanes_object.lane_type': 'lane_type',
  'quote_lanes_object.frequency': 'load_frequency',
  'quote_lanes_object.commitment_type': 'commitment_type',
  'quote_lanes_object.live_load_or_drop': 'live_load_or_drop',
  'quote_lanes_object.priority': 'lane_priority',
  'quote_lanes_object.service_type': 'service_type',
  'quote_lanes_object.trip_type': 'trip_type',
  'quote_lanes_object.us_rate_type': 'rate_type',
  'quote_lanes_object.mx_rate_type': 'rate_type',
  'quote_lanes_object.currency_code': 'currency',
};

export function picklistForField(objectId: string, column: string): PicklistDef | undefined {
  const key = FIELD_PICKLISTS[`${objectId}.${column}`];
  return key ? picklistDef(key) : undefined;
}

// ---- Shared cache: one load per session, refreshed after every administrative change ----

let cache: PicklistValue[] | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

export async function loadPicklists(force = false): Promise<void> {
  if (cache && !force) return;
  if (pending && !force) return pending;
  pending = (async () => {
    const { data, error } = await supabase
      .from('picklist_values')
      .select('id, picklist_key, value, sort_order, is_default, is_system, is_active')
      .order('sort_order', { ascending: true });
    // On error (table not deployed yet, signed out) keep the built-in values and retry next time
    if (!error && data) {
      cache = data as PicklistValue[];
      notify();
    }
    pending = null;
  })();
  return pending;
}

function rowsFor(key: PicklistKey): PicklistValue[] | null {
  if (!cache) return null;
  const rows = cache.filter(r => r.picklist_key === key);
  return rows.length > 0 ? rows : null;
}

/** Active values of a list in display order (built-in values until the database answers). */
export function getPicklistOptions(key: PicklistKey): string[] {
  const rows = rowsFor(key);
  if (!rows) return [...(picklistDef(key)?.builtIn || [])];
  return rows.filter(r => r.is_active).map(r => r.value);
}

/** The list's default value, or '' when the administrator has not set one. */
export function getPicklistDefault(key: PicklistKey): string {
  const rows = rowsFor(key);
  return rows?.find(r => r.is_default && r.is_active)?.value || '';
}

/**
 * Options for a dropdown. Pass the record's current value so a value that was deactivated
 * (or came from an import) is still shown for that record.
 */
export function usePicklist(key: PicklistKey, currentValue?: string | null): string[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion(v => v + 1);
    listeners.add(listener);
    void loadPicklists();
    return () => { listeners.delete(listener); };
  }, []);
  return useMemo(() => {
    const options = getPicklistOptions(key);
    if (currentValue && !options.includes(currentValue)) options.push(currentValue);
    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, currentValue, version]);
}

/** All values of a list (active and inactive) for the administration screens. */
export function usePicklistRows(key: PicklistKey | null): PicklistValue[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion(v => v + 1);
    listeners.add(listener);
    void loadPicklists();
    return () => { listeners.delete(listener); };
  }, []);
  return useMemo(() => {
    if (!key || !cache) return [];
    return cache.filter(r => r.picklist_key === key).sort((a, b) => a.sort_order - b.sort_order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
}

/** Fills the lane's picklist fields that are still empty with each list's default value. */
export function applyLanePicklistDefaults<T extends object>(lane: T): T {
  const defaults: Record<string, string> = {
    lane_type: getPicklistDefault('lane_type'),
    load_frequency: getPicklistDefault('load_frequency'),
    commitment_type: getPicklistDefault('commitment_type'),
    live_load_or_drop: getPicklistDefault('live_load_or_drop'),
    priority: getPicklistDefault('lane_priority'),
  };
  const result: Record<string, unknown> = { ...(lane as Record<string, unknown>) };
  Object.entries(defaults).forEach(([field, value]) => {
    if (value && (result[field] === undefined || result[field] === null || result[field] === '')) result[field] = value;
  });
  return result as T;
}

// ---- Administrative changes (the database enforces the admin.picklists permission) ----

export async function addPicklistValue(key: PicklistKey, value: string): Promise<string | null> {
  const { error } = await supabase.rpc('add_picklist_value', { p_key: key, p_value: value });
  if (error) return error.message;
  await loadPicklists(true);
  return null;
}

export async function reorderPicklistValues(key: PicklistKey, ids: string[]): Promise<string | null> {
  const { error } = await supabase.rpc('reorder_picklist_values', { p_key: key, p_ids: ids });
  if (error) return error.message;
  await loadPicklists(true);
  return null;
}

export async function setPicklistDefault(key: PicklistKey, id: string | null): Promise<string | null> {
  const { error } = await supabase.rpc('set_picklist_default', { p_key: key, p_id: id });
  if (error) return error.message;
  await loadPicklists(true);
  return null;
}

export async function setPicklistValueActive(id: string, active: boolean): Promise<string | null> {
  const { error } = await supabase.from('picklist_values').update({ is_active: active }).eq('id', id);
  if (error) return error.message;
  await loadPicklists(true);
  return null;
}
