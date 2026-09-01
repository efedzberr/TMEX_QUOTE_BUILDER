import { QUOTE_FIELD_CATALOG } from './quoteFieldCatalog';

export type ObjectFieldType = 'Text' | 'Picklist' | 'Number' | 'Currency' | 'Date' | 'Datetime' | 'Checkbox' | 'User';

export interface ObjectFieldDef {
  label: string;
  column: string;
  type: ObjectFieldType;
  required: boolean;
  notes?: string;
}

export interface AdminObjectDef {
  id: string;
  label: string;
  table: string | null;
  countFlag?: string;
  fieldsOnly?: boolean;
  note?: string;
  fields: ObjectFieldDef[];
}

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
    id: 'quotes_object', label: 'Quotes', table: 'quotes', fieldsOnly: true,
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
      notes: f.computed ? 'Computed \u2014 calculated live, not stored' : undefined,
    })),
  },
];

export function adminObjectFor(id: string): AdminObjectDef | undefined {
  return ADMIN_OBJECTS.find(o => o.id === id);
}
