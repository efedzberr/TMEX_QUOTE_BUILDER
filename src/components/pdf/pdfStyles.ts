import { StyleSheet } from '@react-pdf/renderer';

export const PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
  legal: { width: 612, height: 1008 },
} as const;

export const PAGE_MARGINS = { top: 18, bottom: 18, left: 18, right: 18 };

export function getPageDimensions(pageSize: 'letter' | 'a4' | 'legal', orientation: 'portrait' | 'landscape') {
  const base = PAGE_SIZES[pageSize];
  if (orientation === 'landscape') return { width: base.height, height: base.width };
  return base;
}

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#111827',
    paddingTop: PAGE_MARGINS.top,
    paddingBottom: PAGE_MARGINS.bottom + 14,
    paddingLeft: PAGE_MARGINS.left,
    paddingRight: PAGE_MARGINS.right,
  },
  headerRow: {
    flexDirection: 'row',
    width: '100%',
  },
  tableHeaderCell: {
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    padding: '2pt 3pt',
    textTransform: 'uppercase',
  },
  tableDataCell: {
    fontSize: 7,
    padding: '2pt 3pt',
    borderRight: '0.3pt solid #E5E7EB',
  },
  sectionHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    padding: '3pt 4pt',
    textTransform: 'uppercase',
  },
  dataRow: {
    flexDirection: 'row',
    borderBottom: '0.3pt solid #E5E7EB',
  },
  footerTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#1E40AF',
    borderBottom: '0.5pt solid #1E40AF',
    marginBottom: 3,
    paddingBottom: 2,
    textTransform: 'uppercase',
  },
  bulletItem: {
    fontSize: 7,
    marginBottom: 2,
    paddingLeft: 8,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 10,
    right: 20,
    fontSize: 6,
    color: '#9CA3AF',
  },
});

export const COLUMN_GROUP_COLORS: Record<string, string> = {
  general: '#1E40AF',
  us: '#1D4ED8',
  mx: '#166534',
  other: '#374151',
};

const GENERAL_KEYS = new Set(['origin_city', 'destination_city', 'border_crossing_city', 'border_crossing_fee', 'lane_total']);
const US_PREFIXES = ['us_', 'total_us'];
const MX_PREFIXES = ['mx_', 'total_mx'];

export function getColumnGroupColor(key: string): string {
  if (GENERAL_KEYS.has(key)) return COLUMN_GROUP_COLORS.general;
  if (US_PREFIXES.some(p => key.startsWith(p))) return COLUMN_GROUP_COLORS.us;
  if (MX_PREFIXES.some(p => key.startsWith(p))) return COLUMN_GROUP_COLORS.mx;
  return COLUMN_GROUP_COLORS.other;
}

export function resolveTextColor(bgColor: string): string {
  if (!bgColor || bgColor === 'transparent' || bgColor === '#FFFFFF' || bgColor === '#F9FAFB') return '#111827';
  return '#FFFFFF';
}

export function lightenColor(hex: string): string {
  if (!hex || hex === 'transparent') return '#F3F4F6';
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.min(255, Math.round(r + (255 - r) * 0.8));
    const lg = Math.min(255, Math.round(g + (255 - g) * 0.8));
    const lb = Math.min(255, Math.round(b + (255 - b) * 0.8));
    return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
  } catch {
    return '#F3F4F6';
  }
}

const MONETARY_KEYS = new Set([
  'border_crossing_fee', 'lane_total', 'us_lh', 'mx_lh', 'us_line_haul', 'mx_line_haul',
  'accessorials', 'us_fuel_rate_per_mile', 'us_rate_per_mile', 'total_us_fuel', 'total_us_fixed',
  'total_us_variable', 'total_us_portion', 'mx_fuel_rate_per_mile', 'mx_rate_per_mile',
  'total_mx_fuel', 'total_mx_fixed', 'total_mx_variable', 'total_mx_portion', 'invoice_value',
]);

const NUMERIC_KEYS = new Set([
  'us_miles', 'mx_miles', 'weight',
]);

export function isRightAligned(key: string): boolean {
  return MONETARY_KEYS.has(key) || NUMERIC_KEYS.has(key);
}
