import { QUOTE_FIELD_CATALOG } from './quoteFieldCatalog';

export type ObjectFieldType = 'Text' | 'Picklist' | 'Number' | 'Currency' | 'Date' | 'Datetime' | 'Checkbox' | 'User';

export interface ObjectFieldDef {
  label: string;
  column: string;
  type: ObjectFieldType;
  required: boolean;
  notes?: string;
  /** false when the value is derived at runtime (not a stored column) and cannot be history-tracked */
  trackable?: boolean;
}

export type HistoryTrackingObject = 'quote' | 'quote_lane';

export interface AdminObjectDef {
  id: string;
  label: string;
  table: string | null;
  countFlag?: string;
  fieldsOnly?: boolean;
  note?: string;
  /** when set, the object gets a "History Tracking" tab keyed by this object name */
  historyTracking?: HistoryTrackingObject;
  fields: ObjectFieldDef[];
}

/** Quote fields that are derived from the clock at read time; they have no stored value. */
const CLOCK_DERIVED_QUOTE_FIELDS = new Set(['due_status', 'age_days', 'total_hours', 'effective_hours', 'hold_hours']);

const QUOTE_LANE_FIELDS: ObjectFieldDef[] = [
  { label: 'Origin City', column: 'origin_city', type: 'Text', required: true },
  { label: 'Destination City', column: 'destination_city', type: 'Text', required: true },
  { label: 'Border Crossing City', column: 'border_crossing', type: 'Text', required: true },
  { label: 'Border Crossing Fee', column: 'border_crossing_fee', type: 'Currency', required: false },
  { label: 'Service Type', column: 'service_type', type: 'Picklist', required: false },
  { label: 'Trip Type', column: 'trip_type', type: 'Picklist', required: false },
  { label: 'Lane Type', column: 'lane_type', type: 'Picklist', required: false },
  { label: 'Lane Status', column: 'lane_status', type: 'Picklist', required: false },
  { label: 'Equipment Type', column: 'equipment_type', type: 'Picklist', required: false },
  { label: 'Border Crossing Only', column: 'border_crossing_only', type: 'Checkbox', required: false },
  { label: 'US Miles', column: 'us_miles', type: 'Number', required: false },
  { label: 'US Rate Type', column: 'us_rate_type', type: 'Picklist', required: false },
  { label: 'US Rate Per Mile', column: 'us_rate_per_mile', type: 'Currency', required: false },
  { label: 'US Line Haul', column: 'us_rate', type: 'Currency', required: false },
  { label: 'US Fuel Rate Per Mile', column: 'us_fuel_rate', type: 'Currency', required: false },
  { label: 'US Fuel Difference', column: 'us_fuel_difference', type: 'Currency', required: false },
  { label: 'US Accessorials Amount', column: 'us_accessorials_amount', type: 'Currency', required: false },
  { label: 'Estimated Total US Section', column: 'estimated_total_us_section', type: 'Currency', required: false },
  { label: 'MX Miles', column: 'mx_miles', type: 'Number', required: false },
  { label: 'MX Rate Type', column: 'mx_rate_type', type: 'Picklist', required: false },
  { label: 'MX Rate Per Mile', column: 'mx_rate_per_mile', type: 'Currency', required: false },
  { label: 'MX Line Haul', column: 'mx_rate', type: 'Currency', required: false },
  { label: 'MX Fuel Rate Per Mile', column: 'mx_fuel_rate', type: 'Currency', required: false },
  { label: 'MX Fuel Difference', column: 'mx_fuel_difference', type: 'Currency', required: false },
  { label: 'MX Accessorials Amount', column: 'mx_accessorials_amount', type: 'Currency', required: false },
  { label: 'Estimated Total MX Section', column: 'estimated_total_mx_section', type: 'Currency', required: false },
  { label: 'Toll Rate', column: 'toll_rate', type: 'Currency', required: false },
  { label: 'Accessorials Amount', column: 'accessorials_amount', type: 'Currency', required: false },
  { label: 'Requested Price', column: 'requested_price', type: 'Currency', required: false },
  { label: 'Requested Discount %', column: 'requested_discount_percent', type: 'Number', required: false },
  { label: 'Target', column: 'target', type: 'Text', required: false },
  { label: 'Currency', column: 'currency_code', type: 'Picklist', required: false },
  { label: 'Units', column: 'units_code', type: 'Picklist', required: false },
  { label: 'Effective From', column: 'effective_from_date', type: 'Date', required: false },
  { label: 'Effective To', column: 'effective_to_date', type: 'Date', required: false },
  { label: 'Commitment Type', column: 'commitment_type', type: 'Picklist', required: false },
  { label: 'Frequency', column: 'frequency', type: 'Picklist', required: false },
  { label: 'Load Frequency', column: 'load_frequency', type: 'Text', required: false },
  { label: 'Load Volume', column: 'load_volume', type: 'Text', required: false },
  { label: 'Volume', column: 'volume', type: 'Text', required: false },
  { label: 'Weight', column: 'weight', type: 'Text', required: false },
  { label: 'Dimensions', column: 'dimensions', type: 'Text', required: false },
  { label: 'Product', column: 'product', type: 'Text', required: false },
  { label: 'Packaging', column: 'packaging', type: 'Text', required: false },
  { label: 'Temperature', column: 'temperature', type: 'Text', required: false },
  { label: 'Temperature Unit', column: 'temperature_unit', type: 'Picklist', required: false },
  { label: 'Tarps', column: 'tarps', type: 'Text', required: false },
  { label: 'Live Load or Drop', column: 'live_load_or_drop', type: 'Picklist', required: false },
  { label: 'UN Number', column: 'un_number', type: 'Text', required: false },
  { label: 'MSDS', column: 'msds', type: 'Checkbox', required: false },
  { label: 'Invoice Value', column: 'invoice_value', type: 'Currency', required: false },
  { label: 'Number of VINs', column: 'number_of_vins', type: 'Number', required: false },
  { label: 'VIN Dimensions', column: 'vin_dimensions', type: 'Text', required: false },
  { label: 'Priority', column: 'priority', type: 'Picklist', required: false },
  { label: 'Comments', column: 'comments', type: 'Text', required: false },
  { label: 'Additional Accessories', column: 'additional_accessories', type: 'Text', required: false },
];

const CITY_FIELDS: ObjectFieldDef[] = [
  { label: 'City', column: 'city_name', type: 'Text', required: true, notes: 'Shown in origin / destination dropdowns' },
  { label: 'City Code', column: 'city_code', type: 'Text', required: false },
  { label: 'Full Name', column: 'city_full_name', type: 'Text', required: false, notes: 'City, ST used across the app' },
  { label: 'State', column: 'state_code', type: 'Text', required: false },
  { label: 'Country', column: 'country_code', type: 'Picklist', required: true, notes: 'USA / MEX \u2014 drives service type rules' },
  { label: 'Market', column: 'market_name', type: 'Text', required: false, notes: 'Circuit market matching' },
  { label: 'Market Code', column: 'market_code', type: 'Text', required: false },
  { label: 'Border Crossing', column: 'is_border_crossing_city', type: 'Checkbox', required: false, notes: 'Loop and border crossing rules' },
];

export const ADMIN_OBJECTS: AdminObjectDef[] = [
  {
    id: 'accounts', label: 'Partner Accounts', table: 'accounts',
    fields: [
      { label: 'Account Name', column: 'account_name', type: 'Text', required: true },
      { label: 'Account Code', column: 'account_code', type: 'Text', required: false },
      { label: 'Type', column: 'type', type: 'Picklist', required: false },
      { label: 'Status', column: 'status', type: 'Picklist', required: false },
      { label: 'Customer Email', column: 'customer_email', type: 'Text', required: false, notes: 'Customer portal notifications' },
      { label: 'Fuel Program', column: 'customer_fuel_program', type: 'Checkbox', required: false, notes: 'Enables the Fuel Program rules on quotes' },
      { label: 'Fuel Program Type', column: 'fuel_program_type', type: 'Picklist', required: false },
      { label: 'Fuel Rate Per Mile', column: 'fuel_rate_per_mile', type: 'Currency', required: false, notes: 'Copied into lanes when the program is active' },
      { label: 'Fuel Program Method', column: 'fuel_program_method', type: 'Picklist', required: false, notes: 'Cost per mile / percent of total' },
    ],
  },
  {
    id: 'bill_to', label: 'Bill To Customers', table: 'bill_to',
    fields: [
      { label: 'Bill To Name', column: 'bill_to_name', type: 'Text', required: true },
      { label: 'Account Code', column: 'account_code', type: 'Text', required: false },
      { label: 'Type', column: 'type', type: 'Picklist', required: false },
      { label: 'Status', column: 'status', type: 'Picklist', required: false },
    ],
  },
  {
    id: 'shippers', label: 'Shippers', table: 'shippers',
    fields: [
      { label: 'Shipper Name', column: 'shipper_name', type: 'Text', required: true },
      { label: 'Account Code', column: 'account_code', type: 'Text', required: false },
      { label: 'Type', column: 'type', type: 'Picklist', required: false },
      { label: 'Status', column: 'status', type: 'Picklist', required: false },
    ],
  },
  { id: 'cities', label: 'Cities', table: 'cities', fields: CITY_FIELDS },
  {
    id: 'border_crossings', label: 'Border Crossing Cities', table: 'cities', countFlag: 'is_border_crossing_city',
    note: 'Subset of the Cities object where Border Crossing = Yes. Same fields as Cities.',
    fields: CITY_FIELDS,
  },
  {
    id: 'account_lanes', label: 'Account Lanes', table: 'Account Lane',
    note: 'Historical contract lanes used by Benchmark. Column names preserve the original file headers.',
    fields: [
      { label: 'ID', column: 'ID', type: 'Text', required: true },
      { label: 'Contract', column: 'Contract', type: 'Text', required: false },
      { label: 'Shipper', column: 'Shipper', type: 'Text', required: false },
      { label: 'Parent Account', column: 'Parent Account', type: 'Text', required: false },
      { label: 'Effective Date', column: 'Effective Date', type: 'Date', required: false },
      { label: 'Origin City', column: 'Origin City', type: 'Text', required: false },
      { label: 'Destination City', column: 'Destination City', type: 'Text', required: false },
      { label: 'Border Crossing City', column: 'Border Crossing City', type: 'Text', required: false },
      { label: 'US Miles', column: 'US Miles', type: 'Number', required: false },
      { label: 'US Rate Per Mile', column: 'US Rate Per Mile', type: 'Currency', required: false },
      { label: 'US Rate', column: 'US Rate', type: 'Currency', required: false },
      { label: 'MX Miles', column: 'MX Miles', type: 'Number', required: false },
      { label: 'MX Rate Per Mile', column: 'MX Rate Per Mile', type: 'Currency', required: false },
      { label: 'MX Rate', column: 'MX Rate', type: 'Currency', required: false },
      { label: 'Border Crossing Rate', column: 'Border Crossing Rate', type: 'Currency', required: false },
      { label: 'Total', column: 'Total', type: 'Currency', required: false, notes: 'Plus the US / MX fuel and cost breakdown columns' },
    ],
  },
  {
    id: 'quotes_object', label: 'Quotes', table: 'quotes', fieldsOnly: true, historyTracking: 'quote',
    note: 'Quote records are managed in the Quotes module; this page documents the object\'s fields.',
    fields: QUOTE_FIELD_CATALOG.map(f => ({
      label: f.label,
      column: f.key,
      type: (f.dataType === 'text' ? 'Text'
        : f.dataType === 'picklist' ? 'Picklist'
        : f.dataType === 'number' ? 'Number'
        : f.dataType === 'currency' ? 'Currency'
        : f.dataType === 'date' ? 'Date'
        : f.dataType === 'datetime' ? 'Datetime'
        : f.dataType === 'user' ? 'User' : 'Text') as ObjectFieldType,
      required: ['quote_number', 'stage', 'status'].includes(f.key),
      notes: CLOCK_DERIVED_QUOTE_FIELDS.has(f.key) ? 'Computed \u2014 calculated live, not stored' : undefined,
      trackable: !CLOCK_DERIVED_QUOTE_FIELDS.has(f.key),
    })),
  },
  {
    id: 'quote_lanes_object', label: 'Quote Lanes', table: 'quote_lanes', fieldsOnly: true, historyTracking: 'quote_lane',
    note: 'Lane records are managed inside each quote; this page documents the object\'s main fields.',
    fields: QUOTE_LANE_FIELDS,
  },
];

export function adminObjectFor(id: string): AdminObjectDef | undefined {
  return ADMIN_OBJECTS.find(o => o.id === id);
}
