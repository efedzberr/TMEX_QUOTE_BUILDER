import { ListViewSort } from '../components/QuotesHomeHeader';

export type FieldDataType = 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'picklist' | 'user';

export interface QuoteFieldDef {
  key: string;
  label: string;
  dataType: FieldDataType;
  sortable: boolean;
  dbColumn?: string;
  align?: 'left' | 'right';
  computed?: boolean;
}

export const QUOTE_FIELD_CATALOG: QuoteFieldDef[] = [
  { key: 'generated_quote_name', label: 'Quote Name', dataType: 'text', sortable: true },
  { key: 'quote_number', label: 'Quote Number', dataType: 'text', sortable: true },
  { key: 'bill_to_customer', label: 'Account', dataType: 'text', sortable: true },
  { key: 'partner_account', label: 'Partner Account', dataType: 'text', sortable: true },
  { key: 'shipper', label: 'Shipper', dataType: 'text', sortable: true },
  { key: 'opportunity', label: 'Opportunity', dataType: 'text', sortable: true },
  { key: 'opportunity_type', label: 'Opportunity Type', dataType: 'picklist', sortable: true },
  { key: 'stage', label: 'Stage', dataType: 'picklist', sortable: true },
  { key: 'status', label: 'Status', dataType: 'picklist', sortable: true },
  { key: 'total_amount', label: 'Total Amount', dataType: 'currency', sortable: true, align: 'right', computed: true },
  { key: 'us_portion', label: 'US Portion', dataType: 'currency', sortable: true, align: 'right' },
  { key: 'mx_rate', label: 'MX Rate', dataType: 'currency', sortable: true, align: 'right' },
  { key: 'border_crossing_fee', label: 'Border Crossing Fee', dataType: 'currency', sortable: true, align: 'right' },
  { key: 'currency', label: 'Currency', dataType: 'picklist', sortable: true },
  { key: 'units', label: 'Units', dataType: 'text', sortable: true },
  { key: 'type_of_service', label: 'Equipment Type', dataType: 'picklist', sortable: true },
  { key: 'us_sales_rep', label: 'US Sales Rep', dataType: 'text', sortable: true },
  { key: 'mx_sales_rep', label: 'MX Sales Rep', dataType: 'text', sortable: true },
  { key: 'owner_name', label: 'Owner', dataType: 'user', sortable: true },
  { key: 'created_at', label: 'Created Date', dataType: 'datetime', sortable: true },
  { key: 'customer_review_status', label: 'Customer Review Status', dataType: 'picklist', sortable: false, computed: true },
];

export const FIELD_CATALOG_MAP = new Map(QUOTE_FIELD_CATALOG.map(f => [f.key, f]));

const LINK_FIELDS = new Set(['generated_quote_name', 'quote_number']);
export function isLinkField(key: string): boolean {
  return LINK_FIELDS.has(key);
}

export function sortLabelFromCatalog(sorting: ListViewSort[]): string {
  if (!sorting || sorting.length === 0) return 'Created Date';
  const field = FIELD_CATALOG_MAP.get(sorting[0].field);
  return field?.label || sorting[0].field;
}
