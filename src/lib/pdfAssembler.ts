import type { Quote, QuoteLane } from './supabase';
import type { PdfConfig, CurrencyMode, UnitsMode, PdfLanguage, TitleConfig, TitleElement, BannerConfig, BannerCell, FullViewFontColorConfig } from './pdfConfigTypes';
import { SECTION_COLORS, buildDefaultTitleConfig, buildDefaultBannerConfig, buildDefaultFullViewFontColors } from './pdfConfigTypes';
import { translateLabel, translateText } from './pdfTranslations';
import type { CurrencyCode } from './constants';

export interface GlobalVariables {
  fuel_rate_usd: number;
  mxn_exchange_rate: number;
  cad_exchange_rate: number;
  us_fuel_difference: number;
}

export interface PDFHeaderFieldValue {
  label: string;
  value: string;
}

export interface PDFLaneBadge {
  serviceType: string;
  tripType: string;
  isSplit: boolean;
  color: string;
}

export interface PDFCondensedRow {
  laneNumber: number;
  badge: PDFLaneBadge;
  cells: Record<string, string>;
}

export interface PDFAccessorialItem {
  name: string;
  rate: string;
  unit: string;
}

export interface PDFLaneBlock {
  laneLabel: { laneNumber: number; serviceType: string; tripType: string };
  sectionColors: { general: string; us: string; mx: string; additional: string };
  sectionFontColors: { general: string; us: string; mx: string; additional: string };
  generalSection: { visible: boolean; fields: PDFHeaderFieldValue[] };
  usSection: { visible: boolean; fields: PDFHeaderFieldValue[]; accessorials: PDFAccessorialItem[] };
  mxSection: { visible: boolean; fields: PDFHeaderFieldValue[]; accessorials: PDFAccessorialItem[] };
  additionalSection: { visible: boolean; fields: PDFHeaderFieldValue[]; comments: string };
}

export interface PDFFooterAccessorialSection {
  type: 'accessorials';
  visible: boolean;
  newPage?: boolean;
  label: string;
  quoteLevel: { label: string; items: { name: string; rate: string; unit: string; included: boolean }[] };
  laneLevel: { laneLabel: string; usAccessorials: PDFAccessorialItem[]; mxAccessorials: PDFAccessorialItem[] }[];
}

export interface PDFFooterTermsSection {
  type: 'terms';
  visible: boolean;
  newPage?: boolean;
  label: string;
  items: { name: string; description: string; included: boolean }[];
}

export interface PDFFooterTextSection {
  type: 'legends' | 'disclaimers' | 'notes';
  visible: boolean;
  newPage?: boolean;
  label: string;
  items: { text: string; included: boolean }[];
}

export interface PDFFooterAcceptanceSection {
  type: 'acceptance';
  visible: boolean;
  newPage?: boolean;
  label: string;
  headerColor: string;
  fields: { key: string; label: string; visible: boolean }[];
}

export type PDFFooterSection =
  | PDFFooterAccessorialSection
  | PDFFooterTermsSection
  | PDFFooterTextSection
  | PDFFooterAcceptanceSection;

export interface PDFTitleElement {
  type: 'empty' | 'image' | 'text' | 'field';
  imageData?: string;
  imageName?: string;
  imageSize?: 'small' | 'medium' | 'large';
  text?: string;
  fontSize?: number;
  bold?: boolean;
  resolvedValue?: string;
}

export interface PDFTitleBar {
  left: PDFTitleElement[];
  center: PDFTitleElement[];
  right: PDFTitleElement[];
  bgColor: string;
  borderEnabled: boolean;
  borderColor: string;
  heightMode: 'auto' | 'fixed';
  heightPt: number;
  firstPageOnly: boolean;
}

export interface PDFBannerCell {
  label: string;
  value: string;
  showLabel: boolean;
}

export interface PDFBanner {
  enabled: boolean;
  cells: PDFBannerCell[];
  bgColor: string;
  textColor: string;
  borderEnabled: boolean;
  borderColor: string;
  heightPt: number;
}

export interface PDFDocument {
  meta: {
    viewType: 'condensed' | 'full';
    orientation: 'portrait' | 'landscape';
    pageSize: 'letter' | 'a4' | 'legal';
    language: 'en' | 'es';
    currency: string;
    units: string;
    generatedAt: string;
    quoteNumber: string;
    quoteName: string;
    exchangeRateWarning?: string;
    fontFamily: string;
    fontBoldFamily: string;
    bodyFontSize: number;
    headerFontSize: number;
  };
  titleBar: PDFTitleBar;
  banner: PDFBanner;
  header: {
    leftColumn: PDFHeaderFieldValue[];
    middleColumn: PDFHeaderFieldValue[];
    rightColumn: PDFHeaderFieldValue[];
  };
  body: PDFCondensedBody | PDFFullBody;
  footer: { sections: PDFFooterSection[] };
}

export interface PDFCondensedBody {
  viewType: 'condensed';
  columns: { key: string; label: string }[];
  rows: PDFCondensedRow[];
}

export interface PDFFullBody {
  viewType: 'full';
  laneBlocks: PDFLaneBlock[];
}

function formatNum(value: number): string {
  const parts = value.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

function dash(): string {
  return '\u2014';
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return dash();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dash();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

function convertCurrency(
  value: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  mxnRate: number,
  cadRate: number
): number {
  if (fromCurrency === toCurrency) return value;
  let usd = value;
  if (fromCurrency === 'MXN') usd = value / (mxnRate || 1);
  else if (fromCurrency === 'CAD') usd = value / (cadRate || 1);
  if (toCurrency === 'USD') return usd;
  if (toCurrency === 'MXN') return usd * (mxnRate || 1);
  if (toCurrency === 'CAD') return usd * (cadRate || 1);
  return usd;
}

function formatLaneCurrency(
  value: number | null | undefined,
  laneCurrency: CurrencyCode,
  configCurrency: CurrencyMode,
  mxnRate: number,
  cadRate: number
): string {
  if (value === null || value === undefined || isNaN(value)) return dash();
  const targetCurrency = configCurrency === 'default' ? laneCurrency : (configCurrency as CurrencyCode);
  const converted = configCurrency === 'default' ? value : convertCurrency(value, laneCurrency, targetCurrency, mxnRate, cadRate);
  return `${targetCurrency} $${formatNum(converted)}`;
}

function formatLaneDistance(
  value: number | null | undefined,
  laneUnits: string | undefined,
  configUnits: UnitsMode
): string {
  if (value === null || value === undefined || isNaN(value) || value === 0) return dash();
  const storesKm = (laneUnits || '').toLowerCase() === 'kilometers' || (laneUnits || '').toLowerCase() === 'km';
  if (configUnits === 'default') {
    return storesKm ? `${formatNum(value)} km` : `${formatNum(value)} mi`;
  }
  if (configUnits === 'kilometers') {
    const km = storesKm ? value : value * 1.60934;
    return `${formatNum(km)} km`;
  }
  const mi = storesKm ? value / 1.60934 : value;
  return `${formatNum(mi)} mi`;
}

function calcSectionAccessorialsTotal(items: any[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum: number, a: any) => {
    if (a.unit_type === 'RPM') return sum + ((a.rate || 0) * (a.miles || 0));
    return sum + (a.rate || 0);
  }, 0);
}

interface LaneCalcs {
  usFuelIncluded: boolean;
  mxFuelIncluded: boolean;
  usAccTotal: number;
  mxAccTotal: number;
  totalUSFuel: number;
  totalMXFuel: number;
  totalUSFixed: number;
  totalMXFixed: number;
  totalUSVariable: number;
  totalMXVariable: number;
  totalUSPortion: number;
  totalMXPortion: number;
  subtotalFixed: number;
  subtotalVariable: number;
  laneTotal: number;
  borderFee: number;
}

function computeLaneCalcs(lane: QuoteLane): LaneCalcs {
  const usFuelIncluded = !!lane.us_fuel_included_in_line_haul;
  const mxFuelIncluded = !!lane.mx_fuel_included_in_line_haul;
  const usAccs: any[] = Array.isArray(lane.us_accessorials_list) ? lane.us_accessorials_list : [];
  const mxAccs: any[] = Array.isArray(lane.mx_accessorials_list) ? lane.mx_accessorials_list : [];
  const usAccTotal = calcSectionAccessorialsTotal(usAccs);
  const mxAccTotal = calcSectionAccessorialsTotal(mxAccs);

  const totalUSFuel = usFuelIncluded ? 0 : (lane.us_miles || 0) * (lane.us_fuel_rate || 0);
  const totalMXFuel = mxFuelIncluded ? 0 : (lane.mx_miles || 0) * (lane.mx_fuel_rate || 0);

  const totalUSFixed = (lane.us_rate || 0) + usAccTotal;
  const totalMXFixed = (lane.mx_rate || 0) + mxAccTotal;

  const totalUSVariable = usFuelIncluded ? 0 : (lane.us_miles || 0) * (lane.us_fuel_rate || 0);
  const totalMXVariable = mxFuelIncluded ? 0 : (lane.mx_miles || 0) * (lane.mx_fuel_rate || 0);

  const isDomestic = (lane.service_type || '').toLowerCase() === 'domestic';
  const isLoop = (lane.service_type || '').toLowerCase() === 'loop' || (lane.service_type || '').toLowerCase() === 'loop service';
  const isBCOnly = !!lane.border_crossing_only;

  const usDisabled = isDomestic ? false : isLoop;
  const mxDisabled = isDomestic || isBCOnly;

  const totalUSPortion = usDisabled ? 0 : totalUSFixed + totalUSVariable;
  const totalMXPortion = mxDisabled ? 0 : totalMXFixed + totalMXVariable;

  const borderFee = isDomestic ? 0 : (lane.border_crossing_fee || 0);

  const usFixed = usDisabled ? 0 : totalUSFixed;
  const mxFixed = mxDisabled ? 0 : totalMXFixed;
  const subtotalFixed = usFixed + mxFixed + borderFee;
  const subtotalVariable = (usDisabled ? 0 : totalUSVariable) + (mxDisabled ? 0 : totalMXVariable);

  let laneTotal: number;
  const svcType = (lane.service_type || '').toLowerCase();
  if (svcType === 'loop' || svcType === 'loop service') {
    laneTotal = totalMXPortion + borderFee;
  } else if (svcType === 'domestic') {
    laneTotal = totalUSPortion;
  } else {
    laneTotal = totalUSPortion + totalMXPortion + borderFee;
  }

  return {
    usFuelIncluded, mxFuelIncluded, usAccTotal, mxAccTotal,
    totalUSFuel, totalMXFuel, totalUSFixed, totalMXFixed,
    totalUSVariable, totalMXVariable, totalUSPortion, totalMXPortion,
    subtotalFixed, subtotalVariable, laneTotal, borderFee,
  };
}

function resolveHeaderFieldValue(
  key: string,
  quote: Quote,
  globalVars: GlobalVariables,
  config: PdfConfig
): string {
  const unitsLabel = config.units_mode === 'kilometers' ? 'Kilometers' : config.units_mode === 'miles' ? 'Miles' : (quote.units || 'Miles');
  const resolvedCurrency = config.currency_mode === 'default' ? (quote.currency || 'USD') : config.currency_mode;

  const map: Record<string, () => string> = {
    shipper_code: () => quote.shipper || dash(),
    currency: () => resolvedCurrency,
    equipment_type: () => quote.type_of_service || dash(),
    customer: () => quote.partner_account || dash(),
    date: () => formatDate(new Date().toISOString()),
    contact_name: () => quote.owner_name || dash(),
    contact_email: () => dash(),
    gm_usa: () => quote.us_sales_rep || dash(),
    mx_sales_rep: () => quote.mx_sales_rep || dash(),
    us_sales_rep: () => quote.us_sales_rep || dash(),
    quote_number: () => quote.quote_number || dash(),
    quote_name: () => quote.generated_quote_name || dash(),
    opportunity: () => quote.opportunity || dash(),
    bco_partner: () => quote.bco_partner || dash(),
    bill_to: () => quote.bill_to_customer || dash(),
    shipper: () => quote.shipper || dash(),
    effective_date: () => dash(),
    expiration_date: () => dash(),
    exchange_rate: () => {
      const rate = globalVars.mxn_exchange_rate || quote.exchange_rate || 0;
      return rate ? `$1.00 USD = $${formatNum(rate)} MXN` : dash();
    },
    us_fuel_rate: () => {
      const diff = globalVars.us_fuel_difference || quote.us_fuel_difference || 0;
      return diff ? `USD $${formatNum(diff)}` : dash();
    },
    mx_fuel_rate: () => {
      const rate = globalVars.fuel_rate_usd || 0;
      return rate ? `USD $${formatNum(rate)}` : dash();
    },
    us_fuel_difference: () => {
      const diff = quote.us_fuel_difference || 0;
      return diff ? `$${formatNum(diff)}` : dash();
    },
    units: () => unitsLabel,
  };

  return map[key]?.() || dash();
}

function buildHeaderColumn(
  fields: { id: string; key: string; label: string }[],
  quote: Quote,
  globalVars: GlobalVariables,
  config: PdfConfig,
  language: PdfLanguage
): PDFHeaderFieldValue[] {
  return fields.map(f => ({
    label: translateLabel(f.label, language),
    value: resolveHeaderFieldValue(f.key, quote, globalVars, config),
  }));
}

function resolveLaneBadge(lane: QuoteLane): PDFLaneBadge {
  const svc = lane.service_type || lane.type_of_service || '';
  const trip = lane.trip_type || '';
  const isSplit = !!lane.split_billing_group;
  let color = '#3B82F6';
  if (isSplit) color = '#10B981';
  else if (svc.toLowerCase().includes('loop')) color = '#F59E0B';
  else if (svc.toLowerCase().includes('domestic')) color = '#6366F1';
  return { serviceType: svc, tripType: trip, isSplit, color };
}

function resolveCondensedCellValue(
  key: string,
  lane: QuoteLane,
  calcs: LaneCalcs,
  config: PdfConfig,
  mxnRate: number,
  cadRate: number,
  language: PdfLanguage
): string {
  const cc = (lane.currency_code || 'USD') as CurrencyCode;
  const fmtC = (v: number | null | undefined) => formatLaneCurrency(v, cc, config.currency_mode, mxnRate, cadRate);
  const fmtD = (v: number | null | undefined, units?: string) => formatLaneDistance(v, units || lane.units_code, config.units_mode);

  const map: Record<string, () => string> = {
    origin_city: () => lane.origin_city || dash(),
    destination_city: () => lane.destination_city || dash(),
    border_crossing_city: () => lane.border_crossing || dash(),
    border_crossing_fee: () => fmtC(lane.border_crossing_fee),
    lane_total: () => fmtC(calcs.laneTotal),
    us_lh: () => fmtC(lane.us_rate),
    mx_lh: () => fmtC(lane.mx_rate),
    us_line_haul: () => fmtC(lane.us_rate),
    mx_line_haul: () => fmtC(lane.mx_rate),
    accessorials: () => fmtC(lane.accessorials_amount),
    stops_before: () => Array.isArray(lane.stops_before) && lane.stops_before.length > 0 ? lane.stops_before.join(', ') : dash(),
    stops_after: () => Array.isArray(lane.stops_after) && lane.stops_after.length > 0 ? lane.stops_after.join(', ') : dash(),
    us_miles: () => fmtD(lane.us_miles),
    us_fuel_rate_per_mile: () => fmtC(lane.us_fuel_rate),
    us_rate_type: () => lane.us_rate_type || lane.rate_type || dash(),
    us_fuel_included: () => translateText(lane.us_fuel_included_in_line_haul ? 'Yes' : 'No', language),
    us_rate_per_mile: () => fmtC(lane.us_rate_per_mile),
    total_us_fuel: () => fmtC(calcs.totalUSFuel),
    total_us_fixed: () => fmtC(calcs.totalUSFixed),
    total_us_variable: () => fmtC(calcs.totalUSVariable),
    total_us_portion: () => fmtC(calcs.totalUSPortion),
    mx_miles: () => fmtD(lane.mx_miles),
    mx_fuel_rate_per_mile: () => fmtC(lane.mx_fuel_rate),
    mx_rate_type: () => lane.mx_rate_type || lane.rate_type || dash(),
    mx_fuel_included: () => translateText(lane.mx_fuel_included_in_line_haul ? 'Yes' : 'No', language),
    mx_rate_per_mile: () => fmtC(lane.mx_rate_per_mile),
    total_mx_fuel: () => fmtC(calcs.totalMXFuel),
    total_mx_fixed: () => fmtC(calcs.totalMXFixed),
    total_mx_variable: () => fmtC(calcs.totalMXVariable),
    total_mx_portion: () => fmtC(calcs.totalMXPortion),
    lane_type: () => lane.lane_type || dash(),
    load_volume: () => lane.load_volume || dash(),
    load_frequency: () => lane.load_frequency || dash(),
    commitment_type: () => lane.commitment_type || dash(),
    target: () => lane.target || dash(),
    product: () => lane.product || dash(),
    equipment_type: () => lane.equipment_type || dash(),
    priority: () => lane.priority || dash(),
    un_number: () => lane.un_number || dash(),
    msds: () => translateText(lane.msds ? 'Yes' : 'No', language),
    weight: () => lane.weight ? `${lane.weight}` : dash(),
    dimensions: () => lane.dimensions || dash(),
    invoice_value: () => fmtC(lane.invoice_value),
    temperature: () => lane.temperature || dash(),
    packing: () => lane.packaging || dash(),
    live_load_or_drop: () => lane.live_load_or_drop || dash(),
    comments: () => lane.comments || dash(),
    transit_time: () => dash(),
    vol_lpm: () => lane.load_volume || dash(),
  };

  return map[key]?.() || dash();
}

function buildCondensedBody(
  config: PdfConfig,
  lanes: QuoteLane[],
  mxnRate: number,
  cadRate: number,
  language: PdfLanguage
): PDFCondensedBody {
  const columns = config.condensed_columns.map(c => ({
    key: c.key,
    label: translateLabel(c.label, language),
  }));

  const rows: PDFCondensedRow[] = lanes.map((lane, idx) => {
    const calcs = computeLaneCalcs(lane);
    const cells: Record<string, string> = {};
    for (const col of config.condensed_columns) {
      cells[col.key] = resolveCondensedCellValue(col.key, lane, calcs, config, mxnRate, cadRate, language);
    }
    return {
      laneNumber: idx + 1,
      badge: resolveLaneBadge(lane),
      cells,
    };
  });

  return { viewType: 'condensed', columns, rows };
}

function resolveSectionColor(sectionKey: 'general' | 'us' | 'mx' | 'additional', colorValue: string): string {
  if (colorValue === 'none') return 'transparent';
  if (colorValue === 'full') return SECTION_COLORS.full[sectionKey];
  if (colorValue === 'gray') return SECTION_COLORS.gray[sectionKey];
  if (colorValue === 'white') return SECTION_COLORS.white[sectionKey];
  if (colorValue.startsWith('#')) return colorValue;
  return SECTION_COLORS.full[sectionKey];
}

function buildFullViewLaneBlock(
  lane: QuoteLane,
  laneIdx: number,
  config: PdfConfig,
  calcs: LaneCalcs,
  mxnRate: number,
  cadRate: number,
  language: PdfLanguage
): PDFLaneBlock {
  const cc = (lane.currency_code || 'USD') as CurrencyCode;
  const fmtC = (v: number | null | undefined) => formatLaneCurrency(v, cc, config.currency_mode, mxnRate, cadRate);
  const fmtD = (v: number | null | undefined) => formatLaneDistance(v, lane.units_code, config.units_mode);

  const generalFieldMap: Record<string, () => string> = {
    origin_city: () => lane.origin_city || dash(),
    destination_city: () => lane.destination_city || dash(),
    border_crossing_city: () => lane.border_crossing || dash(),
    border_crossing_fee: () => fmtC(lane.border_crossing_fee),
    subtotal_fixed: () => fmtC(calcs.subtotalFixed),
    subtotal_variable: () => fmtC(calcs.subtotalVariable),
    lane_total: () => fmtC(calcs.laneTotal),
  };

  const usFieldMap: Record<string, () => string> = {
    rate_type: () => lane.us_rate_type || lane.rate_type || dash(),
    miles: () => fmtD(lane.us_miles),
    rpm: () => fmtC(lane.us_rate_per_mile),
    us_lh: () => fmtC(lane.us_rate),
    fuel_pm: () => fmtC(lane.us_fuel_rate),
    total_fuel: () => fmtC(calcs.totalUSFuel),
    total_fixed: () => fmtC(calcs.totalUSFixed),
    total_variable: () => fmtC(calcs.totalUSVariable),
    total_portion: () => fmtC(calcs.totalUSPortion),
  };

  const mxFieldMap: Record<string, () => string> = {
    rate_type: () => lane.mx_rate_type || lane.rate_type || dash(),
    miles: () => fmtD(lane.mx_miles),
    rpm: () => fmtC(lane.mx_rate_per_mile),
    mx_lh: () => fmtC(lane.mx_rate),
    fuel_pm: () => fmtC(lane.mx_fuel_rate),
    total_fuel: () => fmtC(calcs.totalMXFuel),
    total_fixed: () => fmtC(calcs.totalMXFixed),
    total_variable: () => fmtC(calcs.totalMXVariable),
    total_portion: () => fmtC(calcs.totalMXPortion),
  };

  const additionalFieldMap: Record<string, () => string> = {
    lane_type: () => lane.lane_type || dash(),
    load_volume: () => lane.load_volume || dash(),
    load_frequency: () => lane.load_frequency || dash(),
    commitment_type: () => lane.commitment_type || dash(),
    target: () => lane.target || dash(),
    product: () => lane.product || dash(),
    equipment_type: () => lane.equipment_type || dash(),
  };

  function mapFields(sectionFields: { key: string; label: string; visible: boolean }[], fieldMap: Record<string, () => string>): PDFHeaderFieldValue[] {
    return sectionFields
      .filter(f => f.visible)
      .map(f => ({
        label: translateLabel(f.label, language),
        value: fieldMap[f.key]?.() || dash(),
      }));
  }

  function mapAccessorials(accList: any[]): PDFAccessorialItem[] {
    if (!Array.isArray(accList)) return [];
    return accList.map((a: any) => ({
      name: language === 'es' && a.name_es ? a.name_es : (a.name_en || a.name || ''),
      rate: fmtC(a.rate || 0),
      unit: a.unit_type || 'FLAT',
    }));
  }

  const colors = config.full_view_colors;
  const fontColors = config.full_view_font_colors || buildDefaultFullViewFontColors();

  return {
    laneLabel: {
      laneNumber: laneIdx + 1,
      serviceType: lane.service_type || lane.type_of_service || '',
      tripType: lane.trip_type || '',
    },
    sectionColors: {
      general: resolveSectionColor('general', colors.general),
      us: resolveSectionColor('us', colors.us),
      mx: resolveSectionColor('mx', colors.mx),
      additional: resolveSectionColor('additional', colors.additional),
    },
    sectionFontColors: {
      general: fontColors.general,
      us: fontColors.us,
      mx: fontColors.mx,
      additional: fontColors.additional,
    },
    generalSection: {
      visible: config.full_view_sections.general.some(f => f.visible),
      fields: mapFields(config.full_view_sections.general, generalFieldMap),
    },
    usSection: {
      visible: config.full_view_sections.us.some(f => f.visible),
      fields: mapFields(config.full_view_sections.us, usFieldMap),
      accessorials: mapAccessorials(Array.isArray(lane.us_accessorials_list) ? lane.us_accessorials_list : []),
    },
    mxSection: {
      visible: config.full_view_sections.mx.some(f => f.visible),
      fields: mapFields(config.full_view_sections.mx, mxFieldMap),
      accessorials: mapAccessorials(Array.isArray(lane.mx_accessorials_list) ? lane.mx_accessorials_list : []),
    },
    additionalSection: {
      visible: config.full_view_sections.additional.some(f => f.visible),
      fields: mapFields(config.full_view_sections.additional, additionalFieldMap),
      comments: lane.comments || '',
    },
  };
}

function buildFullBody(
  config: PdfConfig,
  lanes: QuoteLane[],
  mxnRate: number,
  cadRate: number,
  language: PdfLanguage
): PDFFullBody {
  return {
    viewType: 'full',
    laneBlocks: lanes.map((lane, idx) => {
      const calcs = computeLaneCalcs(lane);
      return buildFullViewLaneBlock(lane, idx, config, calcs, mxnRate, cadRate, language);
    }),
  };
}

function buildFooter(
  config: PdfConfig,
  quote: Quote,
  lanes: QuoteLane[],
  mxnRate: number,
  cadRate: number,
  language: PdfLanguage
): { sections: PDFFooterSection[] } {
  const sections: PDFFooterSection[] = [];

  for (const sectionCfg of config.footer_sections) {
    switch (sectionCfg.key) {
      case 'accessorials': {
        const quoteAccs: any[] = Array.isArray(quote.accessorials_list) ? quote.accessorials_list : [];
        const quoteItems = quoteAccs.map((a: any) => ({
          name: language === 'es' && a.name_es ? a.name_es : (a.name_en || a.name || ''),
          rate: formatLaneCurrency(a.rate || 0, (quote.currency || 'USD') as CurrencyCode, config.currency_mode, mxnRate, cadRate),
          unit: a.unit_type || 'FLAT',
          included: config.footer_accessorials.quoteLevel[a.id] !== false,
        }));

        const laneLevelItems = lanes
          .map((lane, idx) => {
            const usAccs: any[] = Array.isArray(lane.us_accessorials_list) ? lane.us_accessorials_list : [];
            const mxAccs: any[] = Array.isArray(lane.mx_accessorials_list) ? lane.mx_accessorials_list : [];
            if (usAccs.length === 0 && mxAccs.length === 0) return null;
            const cc = (lane.currency_code || 'USD') as CurrencyCode;
            const laneToggles = config.footer_accessorials.laneLevel[lane.id] || {};
            return {
              laneLabel: `Lane ${idx + 1} \u2014 ${lane.origin_city || '?'} \u2192 ${lane.destination_city || '?'}`,
              usAccessorials: usAccs
                .filter((a: any) => laneToggles[`us-${a.id}`] !== false)
                .map((a: any) => ({
                  name: language === 'es' && a.name_es ? a.name_es : (a.name_en || a.name || ''),
                  rate: formatLaneCurrency(a.rate || 0, cc, config.currency_mode, mxnRate, cadRate),
                  unit: a.unit_type || 'FLAT',
                })),
              mxAccessorials: mxAccs
                .filter((a: any) => laneToggles[`mx-${a.id}`] !== false)
                .map((a: any) => ({
                  name: language === 'es' && a.name_es ? a.name_es : (a.name_en || a.name || ''),
                  rate: formatLaneCurrency(a.rate || 0, cc, config.currency_mode, mxnRate, cadRate),
                  unit: a.unit_type || 'FLAT',
                })),
            };
          })
          .filter(Boolean) as PDFFooterAccessorialSection['laneLevel'];

        sections.push({
          type: 'accessorials',
          visible: sectionCfg.enabled,
          label: translateLabel(sectionCfg.label, language),
          quoteLevel: {
            label: translateLabel('General Accessorials', language),
            items: quoteItems,
          },
          laneLevel: laneLevelItems,
        });
        break;
      }
      case 'terms': {
        const termsList: any[] = Array.isArray(quote.terms_conditions_list) ? quote.terms_conditions_list : [];
        const items = termsList
          .filter((t: any) => !t.type || t.type === 'Term' || t.type === 'term')
          .map((t: any) => ({
            name: language === 'es' && t.name_es ? t.name_es : (t.name_en || ''),
            description: language === 'es' && t.description_es ? t.description_es : (t.description_en || ''),
            included: config.footer_terms[t.id] !== false,
          }));
        if (items.length === 0) {
          const allItems = termsList.map((t: any) => ({
            name: language === 'es' && t.name_es ? t.name_es : (t.name_en || ''),
            description: language === 'es' && t.description_es ? t.description_es : (t.description_en || ''),
            included: config.footer_terms[t.id] !== false,
          }));
          sections.push({
            type: 'terms',
            visible: sectionCfg.enabled,
            label: translateLabel(sectionCfg.label, language),
            items: allItems,
          });
        } else {
          sections.push({
            type: 'terms',
            visible: sectionCfg.enabled,
            label: translateLabel(sectionCfg.label, language),
            items,
          });
        }
        break;
      }
      case 'legends': {
        const termsList: any[] = Array.isArray(quote.terms_conditions_list) ? quote.terms_conditions_list : [];
        const items = termsList
          .filter((t: any) => (t.type || '').toLowerCase() === 'legend')
          .map((t: any) => ({
            text: language === 'es' && t.description_es ? t.description_es : (t.description_en || t.name_en || ''),
            included: config.footer_terms[t.id] !== false,
          }));
        sections.push({
          type: 'legends',
          visible: sectionCfg.enabled,
          label: translateLabel(sectionCfg.label, language),
          items,
        });
        break;
      }
      case 'disclaimers': {
        const termsList: any[] = Array.isArray(quote.terms_conditions_list) ? quote.terms_conditions_list : [];
        const items = termsList
          .filter((t: any) => (t.type || '').toLowerCase() === 'disclaimer')
          .map((t: any) => ({
            text: language === 'es' && t.description_es ? t.description_es : (t.description_en || t.name_en || ''),
            included: config.footer_terms[t.id] !== false,
          }));
        sections.push({
          type: 'disclaimers',
          visible: sectionCfg.enabled,
          label: translateLabel(sectionCfg.label, language),
          items,
        });
        break;
      }
      case 'notes': {
        const termsList: any[] = Array.isArray(quote.terms_conditions_list) ? quote.terms_conditions_list : [];
        const items = termsList
          .filter((t: any) => (t.type || '').toLowerCase() === 'note')
          .map((t: any) => ({
            text: language === 'es' && t.description_es ? t.description_es : (t.description_en || t.name_en || ''),
            included: config.footer_terms[t.id] !== false,
          }));
        sections.push({
          type: 'notes',
          visible: sectionCfg.enabled,
          label: translateLabel(sectionCfg.label, language),
          items,
        });
        break;
      }
      case 'acceptance': {
        const acc = config.footer_acceptance;
        sections.push({
          type: 'acceptance',
          visible: sectionCfg.enabled,
          label: translateLabel(acc.label, language),
          headerColor: acc.headerColor,
          fields: [
            { key: 'company', label: translateLabel('Company', language), visible: acc.fields.company },
            { key: 'date', label: translateLabel('Date', language), visible: acc.fields.date },
            { key: 'jobTitle', label: translateLabel('Job Title', language), visible: acc.fields.jobTitle },
            { key: 'name', label: translateLabel('Name', language), visible: acc.fields.name },
            { key: 'signature', label: translateLabel('Signature', language), visible: acc.fields.signature },
          ],
        });
        break;
      }
    }
  }

  const newPageMap = new Map<string, boolean>();
  for (const sc of config.footer_sections) {
    if (sc.newPage) newPageMap.set(sc.key, true);
  }
  for (const s of sections) {
    const key = s.type;
    if (newPageMap.get(key)) {
      s.newPage = true;
    }
  }

  return { sections };
}

function buildTitleBar(
  config: PdfConfig,
  quote: Quote,
  gv: GlobalVariables,
): PDFTitleBar {
  const tc = config.title_config || buildDefaultTitleConfig();

  function resolveElements(elements: TitleElement[]): PDFTitleElement[] {
    return elements.map(el => {
      const base: PDFTitleElement = { type: el.type };
      if (el.type === 'image') {
        base.imageData = el.imageData;
        base.imageName = el.imageName;
        base.imageSize = el.imageSize || 'medium';
      } else if (el.type === 'text') {
        base.text = el.text || '';
        base.fontSize = el.fontSize;
        base.bold = el.bold;
      } else if (el.type === 'field') {
        base.fontSize = el.fontSize;
        base.bold = el.bold;
        base.resolvedValue = el.fieldKey
          ? resolveHeaderFieldValue(el.fieldKey, quote, gv, config)
          : '';
      }
      return base;
    });
  }

  return {
    left: resolveElements(tc.left.elements),
    center: resolveElements(tc.center.elements),
    right: resolveElements(tc.right.elements),
    bgColor: tc.bgColor,
    borderEnabled: tc.borderEnabled,
    borderColor: tc.borderColor,
    heightMode: tc.heightMode,
    heightPt: tc.heightPt,
    firstPageOnly: tc.firstPageOnly,
  };
}

function buildBanner(
  config: PdfConfig,
  quote: Quote,
  gv: GlobalVariables,
): PDFBanner {
  const bc = config.banner_config || buildDefaultBannerConfig();

  const cells: PDFBannerCell[] = bc.cells.map(cell => ({
    label: cell.label,
    value: cell.fieldKey
      ? resolveHeaderFieldValue(cell.fieldKey, quote, gv, config)
      : '',
    showLabel: cell.showLabel,
  }));

  return {
    enabled: bc.enabled,
    cells,
    bgColor: bc.bgColor,
    textColor: bc.textColor,
    borderEnabled: bc.borderEnabled,
    borderColor: bc.borderColor,
    heightPt: bc.heightPt,
  };
}

export interface AssemblerInput {
  quote: Quote;
  lanes: QuoteLane[];
  configuration: PdfConfig;
  globalVariables: GlobalVariables;
}

export function assemblePDFDocument(input: AssemblerInput): PDFDocument {
  const { quote, lanes, configuration: config, globalVariables: gv } = input;
  const language = config.language;
  const mxnRate = gv.mxn_exchange_rate || quote.exchange_rate || 1;
  const cadRate = gv.cad_exchange_rate || quote.cad_exchange_rate || 1;

  let exchangeRateWarning: string | undefined;
  if (config.currency_mode !== 'default') {
    const needsMxn = config.currency_mode === 'MXN' || lanes.some(l => (l.currency_code || 'USD') === 'MXN');
    const needsCad = config.currency_mode === 'CAD' || lanes.some(l => (l.currency_code || 'USD') === 'CAD');
    if ((needsMxn && !gv.mxn_exchange_rate) || (needsCad && !gv.cad_exchange_rate)) {
      exchangeRateWarning = '* Exchange rate not configured \u2014 values shown in original currency';
    }
  }

  const fontFamily = config.font_family || 'Helvetica';
  const FONT_BOLD_MAP: Record<string, string> = {
    'Helvetica': 'Helvetica-Bold',
    'Times-Roman': 'Times-Bold',
    'Courier': 'Courier-Bold',
  };
  const fontBoldFamily = FONT_BOLD_MAP[fontFamily] || 'Helvetica-Bold';
  const FONT_SIZE_MAP: Record<string, { body: number; header: number }> = {
    small: { body: 6, header: 7 },
    medium: { body: 7, header: 8 },
    large: { body: 8, header: 9 },
  };
  const sizeEntry = FONT_SIZE_MAP[config.font_size || 'medium'] || FONT_SIZE_MAP.medium;

  const meta = {
    viewType: config.view_type,
    orientation: config.orientation,
    pageSize: config.page_size || 'letter' as const,
    language: config.language,
    currency: config.currency_mode,
    units: config.units_mode,
    generatedAt: new Date().toISOString(),
    quoteNumber: quote.quote_number || '',
    quoteName: quote.generated_quote_name || '',
    exchangeRateWarning,
    fontFamily,
    fontBoldFamily,
    bodyFontSize: sizeEntry.body,
    headerFontSize: sizeEntry.header,
  };

  const titleBar = buildTitleBar(config, quote, gv);
  const banner = buildBanner(config, quote, gv);

  const header = {
    leftColumn: buildHeaderColumn(config.header_left, quote, gv, config, language),
    middleColumn: buildHeaderColumn(config.header_middle, quote, gv, config, language),
    rightColumn: buildHeaderColumn(config.header_right, quote, gv, config, language),
  };

  const body = config.view_type === 'condensed'
    ? buildCondensedBody(config, lanes, mxnRate, cadRate, language)
    : buildFullBody(config, lanes, mxnRate, cadRate, language);

  const footer = buildFooter(config, quote, lanes, mxnRate, cadRate, language);

  return { meta, titleBar, banner, header, body, footer };
}
