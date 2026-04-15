export type ViewType = 'condensed' | 'full';
export type Orientation = 'portrait' | 'landscape';
export type PdfLanguage = 'en' | 'es';
export type CurrencyMode = 'default' | 'USD' | 'MXN' | 'CAD';
export type UnitsMode = 'default' | 'miles' | 'kilometers';
export type PageSize = 'letter' | 'a4' | 'legal';
export type SectionColorMode = 'full' | 'gray' | 'white' | 'none';
export type FontFamily = 'Helvetica' | 'Times-Roman' | 'Courier';
export type FontSize = 'small' | 'medium' | 'large';

export interface HeaderField {
  id: string;
  key: string;
  label: string;
}

export interface CondensedColumn {
  id: string;
  key: string;
  label: string;
}

export interface FullViewFieldToggle {
  key: string;
  label: string;
  visible: boolean;
}

export interface FullViewSectionConfig {
  general: FullViewFieldToggle[];
  us: FullViewFieldToggle[];
  mx: FullViewFieldToggle[];
  additional: FullViewFieldToggle[];
}

export interface FullViewColorConfig {
  general: string;
  us: string;
  mx: string;
  additional: string;
}

export type TitleElementType = 'empty' | 'image' | 'text' | 'field';
export type TitleImageSize = 'small' | 'medium' | 'large';

export interface TitleElement {
  type: TitleElementType;
  imageData?: string;
  imageName?: string;
  imageSize?: TitleImageSize;
  text?: string;
  fontSize?: number;
  bold?: boolean;
  fieldKey?: string;
}

export interface TitleZone {
  elements: TitleElement[];
}

export interface TitleConfig {
  left: TitleZone;
  center: TitleZone;
  right: TitleZone;
  bgColor: string;
  borderEnabled: boolean;
  borderColor: string;
  heightMode: 'auto' | 'fixed';
  heightPt: number;
  firstPageOnly: boolean;
}

export interface BannerCell {
  fieldKey: string;
  label: string;
  showLabel: boolean;
}

export interface BannerConfig {
  enabled: boolean;
  cells: BannerCell[];
  bgColor: string;
  textColor: string;
  borderEnabled: boolean;
  borderColor: string;
  heightPt: number;
}

export interface FullViewFontColorConfig {
  general: string;
  us: string;
  mx: string;
  additional: string;
}

export interface FooterSectionConfig {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  collapsed?: boolean;
  newPage?: boolean;
}

export interface AttachedFile {
  name: string;
  size: number;
  data: string;
  order: number;
}

export interface AcceptanceConfig {
  label: string;
  headerColor: string;
  fields: {
    company: boolean;
    date: boolean;
    jobTitle: boolean;
    name: boolean;
    signature: boolean;
  };
}

export interface FooterAccessorialToggles {
  quoteLevel: Record<string, boolean>;
  laneLevel: Record<string, Record<string, boolean>>;
}

export interface FooterTermsToggles {
  [termId: string]: boolean;
}

export interface PdfConfig {
  id?: string;
  quote_id: string;
  view_type: ViewType;
  orientation: Orientation;
  page_size: PageSize;
  language: PdfLanguage;
  currency_mode: CurrencyMode;
  units_mode: UnitsMode;
  font_family: FontFamily;
  font_size: FontSize;
  header_left: HeaderField[];
  header_middle: HeaderField[];
  header_right: HeaderField[];
  condensed_columns: CondensedColumn[];
  full_view_sections: FullViewSectionConfig;
  full_view_colors: FullViewColorConfig;
  full_view_font_colors: FullViewFontColorConfig;
  title_config: TitleConfig;
  banner_config: BannerConfig;
  footer_sections: FooterSectionConfig[];
  footer_accessorials: FooterAccessorialToggles;
  footer_terms: FooterTermsToggles;
  footer_acceptance: AcceptanceConfig;
  attached_files: AttachedFile[];
}

export interface PdfConfigTemplate {
  id: string;
  name: string;
  is_system: boolean;
  config_data: Partial<PdfConfig>;
}

export const HEADER_FIELD_OPTIONS: { key: string; label: string; labelEs: string }[] = [
  { key: 'shipper_code', label: 'Shipper Code', labelEs: 'Codigo de Transportista' },
  { key: 'currency', label: 'Currency', labelEs: 'Moneda' },
  { key: 'equipment_type', label: 'Equipment Type', labelEs: 'Tipo de Equipo' },
  { key: 'customer', label: 'Customer / Parent Account', labelEs: 'Cliente / Cuenta' },
  { key: 'date', label: 'Date', labelEs: 'Fecha' },
  { key: 'contact_name', label: 'Contact Name', labelEs: 'Nombre de Contacto' },
  { key: 'contact_email', label: 'Contact Email', labelEs: 'Correo de Contacto' },
  { key: 'gm_usa', label: 'GM USA', labelEs: 'GM USA' },
  { key: 'mx_sales_rep', label: 'Salesman / MX Sales Rep', labelEs: 'Vendedor / Rep. MX' },
  { key: 'us_sales_rep', label: 'US Sales Rep', labelEs: 'Rep. Ventas US' },
  { key: 'quote_number', label: 'Quote Number', labelEs: 'Numero de Cotizacion' },
  { key: 'quote_name', label: 'Quote Name', labelEs: 'Nombre de Cotizacion' },
  { key: 'opportunity', label: 'Opportunity', labelEs: 'Oportunidad' },
  { key: 'bco_partner', label: 'BCO / Partner', labelEs: 'BCO / Socio' },
  { key: 'bill_to', label: 'Bill To', labelEs: 'Facturar A' },
  { key: 'shipper', label: 'Shipper', labelEs: 'Transportista' },
  { key: 'effective_date', label: 'Effective Date', labelEs: 'Fecha Efectiva' },
  { key: 'expiration_date', label: 'Expiration Date', labelEs: 'Fecha de Vencimiento' },
  { key: 'exchange_rate', label: 'Exchange Rate', labelEs: 'Tipo de Cambio' },
  { key: 'us_fuel_rate', label: 'US Fuel Rate', labelEs: 'Tarifa Combustible US' },
  { key: 'mx_fuel_rate', label: 'MX Fuel Rate', labelEs: 'Tarifa Combustible MX' },
  { key: 'us_fuel_difference', label: 'US Fuel Difference', labelEs: 'Diferencia Combustible US' },
  { key: 'units', label: 'Units', labelEs: 'Unidades' },
];

export const CONDENSED_COLUMN_OPTIONS: { key: string; label: string; labelEs: string }[] = [
  { key: 'origin_city', label: 'Origin City', labelEs: 'Ciudad Origen' },
  { key: 'destination_city', label: 'Destination City', labelEs: 'Ciudad Destino' },
  { key: 'border_crossing_city', label: 'Border Crossing City', labelEs: 'Ciudad Cruce Fronterizo' },
  { key: 'border_crossing_fee', label: 'Border Crossing Fee', labelEs: 'Cuota Cruce Fronterizo' },
  { key: 'lane_total', label: 'Lane Total', labelEs: 'Total de Carril' },
  { key: 'us_lh', label: 'US LH', labelEs: 'LH US' },
  { key: 'mx_lh', label: 'MX LH', labelEs: 'LH MX' },
  { key: 'accessorials', label: 'Accessorials', labelEs: 'Accesorios' },
  { key: 'stops_before', label: 'Stops Before Crossing', labelEs: 'Paradas Antes de Cruce' },
  { key: 'stops_after', label: 'Stops After Crossing', labelEs: 'Paradas Despues de Cruce' },
  { key: 'us_miles', label: 'US Miles', labelEs: 'Millas US' },
  { key: 'us_fuel_rate_per_mile', label: 'US Fuel Rate Per Mile', labelEs: 'Combustible US/Milla' },
  { key: 'us_rate_type', label: 'US Rate Type', labelEs: 'Tipo Tarifa US' },
  { key: 'us_fuel_included', label: 'US Fuel Included in LH', labelEs: 'Combustible US Incluido en LH' },
  { key: 'us_line_haul', label: 'US Line Haul', labelEs: 'Acarreo US' },
  { key: 'us_rate_per_mile', label: 'US Rate Per Mile', labelEs: 'Tarifa US/Milla' },
  { key: 'total_us_fuel', label: 'Total US Fuel', labelEs: 'Total Combustible US' },
  { key: 'total_us_fixed', label: 'Total US Fixed Costs', labelEs: 'Costos Fijos US' },
  { key: 'total_us_variable', label: 'Total US Variable Costs', labelEs: 'Costos Variables US' },
  { key: 'total_us_portion', label: 'Total US Portion', labelEs: 'Porcion Total US' },
  { key: 'mx_miles', label: 'MX Miles', labelEs: 'Millas MX' },
  { key: 'mx_fuel_rate_per_mile', label: 'MX Fuel Rate Per Mile', labelEs: 'Combustible MX/Milla' },
  { key: 'mx_rate_type', label: 'MX Rate Type', labelEs: 'Tipo Tarifa MX' },
  { key: 'mx_fuel_included', label: 'MX Fuel Included in LH', labelEs: 'Combustible MX Incluido en LH' },
  { key: 'mx_line_haul', label: 'MX Line Haul', labelEs: 'Acarreo MX' },
  { key: 'mx_rate_per_mile', label: 'MX Rate Per Mile', labelEs: 'Tarifa MX/Milla' },
  { key: 'total_mx_fuel', label: 'Total MX Fuel', labelEs: 'Total Combustible MX' },
  { key: 'total_mx_fixed', label: 'Total MX Fixed Costs', labelEs: 'Costos Fijos MX' },
  { key: 'total_mx_variable', label: 'Total MX Variable Costs', labelEs: 'Costos Variables MX' },
  { key: 'total_mx_portion', label: 'Total MX Portion', labelEs: 'Porcion Total MX' },
  { key: 'lane_type', label: 'Lane Type', labelEs: 'Tipo de Carril' },
  { key: 'load_volume', label: 'Load Volume', labelEs: 'Volumen de Carga' },
  { key: 'load_frequency', label: 'Load Frequency', labelEs: 'Frecuencia de Carga' },
  { key: 'commitment_type', label: 'Commitment Type', labelEs: 'Tipo de Compromiso' },
  { key: 'target', label: 'Target', labelEs: 'Objetivo' },
  { key: 'product', label: 'Product', labelEs: 'Producto' },
  { key: 'equipment_type', label: 'Equipment Type', labelEs: 'Tipo de Equipo' },
  { key: 'priority', label: 'Priority', labelEs: 'Prioridad' },
  { key: 'un_number', label: 'UN#', labelEs: 'No. UN' },
  { key: 'msds', label: 'MSDS', labelEs: 'MSDS' },
  { key: 'weight', label: 'Weight', labelEs: 'Peso' },
  { key: 'dimensions', label: 'Dimensions', labelEs: 'Dimensiones' },
  { key: 'invoice_value', label: 'Invoice Value', labelEs: 'Valor de Factura' },
  { key: 'temperature', label: 'Temperature', labelEs: 'Temperatura' },
  { key: 'packing', label: 'Packing', labelEs: 'Empaque' },
  { key: 'live_load_or_drop', label: 'Live Load or Drop', labelEs: 'Carga en Vivo o Drop' },
  { key: 'comments', label: 'Comments', labelEs: 'Comentarios' },
  { key: 'transit_time', label: 'Transit Time', labelEs: 'Tiempo de Transito' },
  { key: 'vol_lpm', label: 'VOL/LPM', labelEs: 'VOL/LPM' },
];

export const FULL_VIEW_GENERAL_FIELDS: { key: string; label: string; labelEs: string }[] = [
  { key: 'origin_city', label: 'Origin City', labelEs: 'Ciudad Origen' },
  { key: 'destination_city', label: 'Destination City', labelEs: 'Ciudad Destino' },
  { key: 'border_crossing_city', label: 'Border Crossing City', labelEs: 'Ciudad Cruce Fronterizo' },
  { key: 'border_crossing_fee', label: 'Border Crossing Fee', labelEs: 'Cuota Cruce Fronterizo' },
  { key: 'subtotal_fixed', label: 'Subtotal Fixed Costs', labelEs: 'Subtotal Costos Fijos' },
  { key: 'subtotal_variable', label: 'Subtotal Variable Costs', labelEs: 'Subtotal Costos Variables' },
  { key: 'lane_total', label: 'Lane Total', labelEs: 'Total de Carril' },
];

export const FULL_VIEW_US_FIELDS: { key: string; label: string; labelEs: string }[] = [
  { key: 'rate_type', label: 'Rate Type', labelEs: 'Tipo Tarifa' },
  { key: 'miles', label: 'Miles', labelEs: 'Millas' },
  { key: 'rpm', label: 'RPM / Rate Per Mile', labelEs: 'RPM / Tarifa por Milla' },
  { key: 'us_lh', label: 'US LH', labelEs: 'LH US' },
  { key: 'fuel_pm', label: 'Fuel PM', labelEs: 'Combustible PM' },
  { key: 'total_fuel', label: 'Total US Fuel', labelEs: 'Total Combustible US' },
  { key: 'total_fixed', label: 'Total US Fixed Costs', labelEs: 'Costos Fijos US' },
  { key: 'total_variable', label: 'Total US Variable Costs', labelEs: 'Costos Variables US' },
  { key: 'total_portion', label: 'Total US Portion', labelEs: 'Porcion Total US' },
];

export const FULL_VIEW_MX_FIELDS: { key: string; label: string; labelEs: string }[] = [
  { key: 'rate_type', label: 'Rate Type', labelEs: 'Tipo Tarifa' },
  { key: 'miles', label: 'Miles', labelEs: 'Millas' },
  { key: 'rpm', label: 'RPM / Rate Per Mile', labelEs: 'RPM / Tarifa por Milla' },
  { key: 'mx_lh', label: 'MX LH', labelEs: 'LH MX' },
  { key: 'fuel_pm', label: 'Fuel PM', labelEs: 'Combustible PM' },
  { key: 'total_fuel', label: 'Total MX Fuel', labelEs: 'Total Combustible MX' },
  { key: 'total_fixed', label: 'Total MX Fixed Costs', labelEs: 'Costos Fijos MX' },
  { key: 'total_variable', label: 'Total MX Variable Costs', labelEs: 'Costos Variables MX' },
  { key: 'total_portion', label: 'Total MX Portion', labelEs: 'Porcion Total MX' },
];

export const FULL_VIEW_ADDITIONAL_FIELDS: { key: string; label: string; labelEs: string }[] = [
  { key: 'lane_type', label: 'Lane Type', labelEs: 'Tipo de Carril' },
  { key: 'load_volume', label: 'Load Volume', labelEs: 'Volumen de Carga' },
  { key: 'load_frequency', label: 'Load Frequency', labelEs: 'Frecuencia de Carga' },
  { key: 'commitment_type', label: 'Commitment Type', labelEs: 'Tipo de Compromiso' },
  { key: 'target', label: 'Target', labelEs: 'Objetivo' },
  { key: 'product', label: 'Product', labelEs: 'Producto' },
  { key: 'equipment_type', label: 'Equipment Type', labelEs: 'Tipo de Equipo' },
];

export const SECTION_COLORS = {
  full: {
    general: '#1E40AF',
    us: '#DC2626',
    mx: '#166534',
    additional: '#374151',
  },
  gray: {
    general: '#4B5563',
    us: '#6B7280',
    mx: '#9CA3AF',
    additional: '#D1D5DB',
  },
  white: {
    general: '#FFFFFF',
    us: '#FFFFFF',
    mx: '#FFFFFF',
    additional: '#FFFFFF',
  },
  none: {
    general: 'transparent',
    us: 'transparent',
    mx: 'transparent',
    additional: 'transparent',
  },
} as const;

export const DEFAULT_FOOTER_SECTIONS: FooterSectionConfig[] = [
  { id: 'accessorials', key: 'accessorials', label: 'Accessorials', enabled: true },
  { id: 'terms', key: 'terms', label: 'Terms & Conditions', enabled: true },
  { id: 'legends', key: 'legends', label: 'Legends', enabled: true },
  { id: 'disclaimers', key: 'disclaimers', label: 'Disclaimers', enabled: true },
  { id: 'notes', key: 'notes', label: 'Notes', enabled: true },
  { id: 'acceptance', key: 'acceptance', label: 'Rate Accepted By', enabled: true },
  { id: 'attachments', key: 'attachments', label: 'Attach PDF Files', enabled: false },
];

export const DEFAULT_ACCEPTANCE: AcceptanceConfig = {
  label: 'RATE ACCEPTED BY:',
  headerColor: '#F59E0B',
  fields: {
    company: true,
    date: true,
    jobTitle: true,
    name: true,
    signature: true,
  },
};

let _nextId = 1;
export function genId(): string {
  return `field_${Date.now()}_${_nextId++}`;
}

export function buildDefaultHeaderLeft(): HeaderField[] {
  return [
    { id: genId(), key: 'shipper_code', label: 'Shipper Code' },
    { id: genId(), key: 'currency', label: 'Currency' },
    { id: genId(), key: 'equipment_type', label: 'Equipment Type' },
  ];
}

export function buildDefaultHeaderMiddle(): HeaderField[] {
  return [
    { id: genId(), key: 'customer', label: 'Customer' },
    { id: genId(), key: 'date', label: 'Date' },
    { id: genId(), key: 'contact_name', label: 'Contact' },
    { id: genId(), key: 'contact_email', label: 'Contact Email' },
  ];
}

export function buildDefaultHeaderRight(): HeaderField[] {
  return [
    { id: genId(), key: 'gm_usa', label: 'GM USA' },
    { id: genId(), key: 'mx_sales_rep', label: 'Salesman' },
  ];
}

export function buildDefaultCondensedColumns(): CondensedColumn[] {
  const defaultKeys = [
    'origin_city', 'destination_city', 'border_crossing_city', 'border_crossing_fee',
    'lane_total', 'us_miles', 'us_rate_per_mile', 'us_fuel_rate_per_mile',
    'us_line_haul', 'mx_miles', 'mx_rate_per_mile', 'mx_fuel_rate_per_mile', 'mx_line_haul',
  ];
  return defaultKeys.map(key => {
    const opt = CONDENSED_COLUMN_OPTIONS.find(o => o.key === key);
    return { id: genId(), key, label: opt?.label || key };
  });
}

export function buildDefaultFullViewSections(): FullViewSectionConfig {
  return {
    general: FULL_VIEW_GENERAL_FIELDS.map(f => ({ key: f.key, label: f.label, visible: true })),
    us: FULL_VIEW_US_FIELDS.map(f => ({ key: f.key, label: f.label, visible: true })),
    mx: FULL_VIEW_MX_FIELDS.map(f => ({ key: f.key, label: f.label, visible: true })),
    additional: FULL_VIEW_ADDITIONAL_FIELDS.map(f => ({ key: f.key, label: f.label, visible: true })),
  };
}

export function buildDefaultFullViewColors(): FullViewColorConfig {
  return { general: 'full', us: 'full', mx: 'full', additional: 'full' };
}

export function buildDefaultFullViewFontColors(): FullViewFontColorConfig {
  return { general: '#FFFFFF', us: '#FFFFFF', mx: '#FFFFFF', additional: '#FFFFFF' };
}

export function buildDefaultTitleConfig(): TitleConfig {
  return {
    left: {
      elements: [
        { type: 'image', imageName: 'Transmex_Logo.jpeg', imageSize: 'medium' },
      ],
    },
    center: {
      elements: [
        { type: 'field', fieldKey: 'customer', bold: true, fontSize: 11 },
        { type: 'field', fieldKey: 'date', fontSize: 7 },
      ],
    },
    right: {
      elements: [
        { type: 'image', imageName: 'Transmex_Logo_II.jpeg', imageSize: 'small' },
        { type: 'field', fieldKey: 'quote_number', fontSize: 6 },
      ],
    },
    bgColor: '#FFFFFF',
    borderEnabled: true,
    borderColor: '#1E40AF',
    heightMode: 'auto',
    heightPt: 50,
    firstPageOnly: true,
  };
}

export function buildDefaultBannerConfig(): BannerConfig {
  return {
    enabled: true,
    cells: [
      { fieldKey: 'equipment_type', label: 'Equipment:', showLabel: true },
      { fieldKey: '', label: '', showLabel: false },
      { fieldKey: 'us_fuel_rate', label: 'US Fuel:', showLabel: true },
      { fieldKey: 'mx_fuel_rate', label: 'MX Fuel:', showLabel: true },
      { fieldKey: '', label: '', showLabel: false },
      { fieldKey: 'currency', label: 'Currency:', showLabel: true },
    ],
    bgColor: '#F3F4F6',
    textColor: '#374151',
    borderEnabled: true,
    borderColor: '#E5E7EB',
    heightPt: 16,
  };
}

export function suggestFontColor(bgHex: string): string {
  if (!bgHex || bgHex === 'transparent' || bgHex === 'none') return '#111827';
  try {
    const r = parseInt(bgHex.slice(1, 3), 16);
    const g = parseInt(bgHex.slice(3, 5), 16);
    const b = parseInt(bgHex.slice(5, 7), 16);
    const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
    const l = (max + min) / 2;
    return l > 0.6 ? '#111827' : '#FFFFFF';
  } catch {
    return '#FFFFFF';
  }
}

export function buildDefaultConfig(quoteId: string): PdfConfig {
  return {
    quote_id: quoteId,
    view_type: 'condensed',
    orientation: 'portrait',
    page_size: 'letter',
    language: 'en',
    currency_mode: 'default',
    units_mode: 'default',
    font_family: 'Helvetica',
    font_size: 'medium',
    header_left: buildDefaultHeaderLeft(),
    header_middle: buildDefaultHeaderMiddle(),
    header_right: buildDefaultHeaderRight(),
    condensed_columns: buildDefaultCondensedColumns(),
    full_view_sections: buildDefaultFullViewSections(),
    full_view_colors: buildDefaultFullViewColors(),
    full_view_font_colors: buildDefaultFullViewFontColors(),
    title_config: buildDefaultTitleConfig(),
    banner_config: buildDefaultBannerConfig(),
    footer_sections: DEFAULT_FOOTER_SECTIONS.map(s => ({ ...s })),
    footer_accessorials: { quoteLevel: {}, laneLevel: {} },
    footer_terms: {},
    footer_acceptance: { ...DEFAULT_ACCEPTANCE, fields: { ...DEFAULT_ACCEPTANCE.fields } },
    attached_files: [],
  };
}
