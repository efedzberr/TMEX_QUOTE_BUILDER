export const OWNERS = [
  'Susana Guajardo',
  'Marinthia Sierra',
  'Daniel Rodriguez',
  'Brenda Guayante',
  'Gabriela Longoria',
  'Brissel Jimenez',
  'Cintya Rojo',
  'Adriana Romero',
];

export const MX_SALES_REPRESENTATIVES = [
  'Alberto Paz',
  'Estrella García',
  'Octavio Paz',
  'Marianna Beltrán',
  'Alejandro Nájera',
  'Marcela Zambrano',
  'Cesar Ruiz',
  'Héctor Ayala',
  'Gustavo Jacobo',
  'Jorge Gordillo',
  'Ricardo García',
  'Monica Elizondo',
  'TOP Management',
];

export const US_SALES_REPRESENTATIVES = [
  'Connie Hills',
  'Adam Trask',
  'Cassie Baldwin',
  'Kristy Welsh',
  'John Bartman',
  'Sean Kelley',
  'Zack Palmer',
  'Todd Ridgeway',
  'Bryant Glass',
  'Chris Castro',
  'Jacob Bushman',
  'Kamron Proos',
  'Pleasent Norris - PQ',
  'Steven Gacho',
  'Shane Hoss',
  'Jim Rich',
];

export const EQUIPMENT_TYPES = [
  'Dry Van',
  'Flatbed',
  'Refrigerated / Reefer',
  'Hazmat',
  'Step Deck',
  'Tanker',
  'Intermodal',
];

export const STAGES = [
  'New',
  'In Progress',
  'Completed',
  'Branch Manager Approval',
  'Sent to Customer',
  'Published',
];

export const LOCKED_STAGES = new Set([
  'Completed',
  'Branch Manager Approval',
  'Sent to Customer',
  'Published',
]);

export function isQuoteLocked(stage: string | undefined | null): boolean {
  return LOCKED_STAGES.has(stage || 'New');
}

export const TRIP_TYPES = [
  'One Way',
  'Round Trip',
  'Circuit',
];

export const BORDER_CROSSINGS = [
  'Tijuana',
  'Mexicali',
  'Nogales',
  'Ciudad Juárez',
  'Nuevo Laredo',
  'Reynosa',
];

export const RATE_TYPES = [
  'FLT',
  'RPM',
];

export const LOAD_FREQUENCIES = [
  'Daily',
  'Weekly',
  'Bi-Weekly',
  'Monthly',
  'Yearly',
  'On-Demand',
];

export const LANE_TYPES = [
  'Recurring',
  'Spot',
  'Project',
];

export const PRIORITIES = [
  'Priority 1',
  'Priority 2',
  'Priority 3',
  'Priority 4',
  'Priority 5',
];

export const COMMITMENT_TYPES = [
  'Primary',
  'Secondary',
];

export const LIVE_LOAD_OPTIONS = [
  'Live Load',
  'Drop',
];

export const CURRENCIES = ['USD', 'MXN', 'CAD'] as const;
export type CurrencyCode = typeof CURRENCIES[number];

export const MONETARY_LANE_FIELDS = [
  'us_rate',
  'us_fuel_rate',
  'mx_rate',
  'mx_fuel_rate',
  'border_crossing_fee',
  'border_crossing_rate',
  'us_rate_per_mile',
  'mx_rate_per_mile',
] as const;

export function convertLaneValues(
  values: Partial<Record<string, number>>,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  exchangeRate: number,
  cadRate: number
): Partial<Record<string, number>> {
  if (fromCurrency === toCurrency) return values;

  const toUSD = (val: number, from: CurrencyCode): number => {
    if (from === 'USD') return val;
    if (from === 'MXN') return val / exchangeRate;
    if (from === 'CAD') return val / cadRate;
    return val;
  };

  const fromUSD = (val: number, to: CurrencyCode): number => {
    if (to === 'USD') return val;
    if (to === 'MXN') return val * exchangeRate;
    if (to === 'CAD') return val * cadRate;
    return val;
  };

  const convert = (val: number) => fromUSD(toUSD(val, fromCurrency), toCurrency);

  const result: Partial<Record<string, number>> = {};
  for (const field of MONETARY_LANE_FIELDS) {
    const val = values[field];
    if (typeof val === 'number') {
      result[field] = convert(val);
    }
  }
  if (typeof values.accessorials_amount === 'number') {
    result.accessorials_amount = convert(values.accessorials_amount);
  }
  return result;
}

function formatNumber(value: number): string {
  const parts = value.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

export function formatCurrency(value: number | null | undefined, currencyCode: CurrencyCode = 'USD'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  return `${currencyCode} $${formatNumber(value)}`;
}

export function formatCurrencyOrDash(value: number | null | undefined, currencyCode: CurrencyCode = 'USD'): string {
  if (value === null || value === undefined || isNaN(value) || value === 0) {
    return '—';
  }
  return `${currencyCode} $${formatNumber(value)}`;
}

function getInitials(fullName: string): string {
  if (!fullName) return 'XX';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return 'XX';
  const first = (parts[0][0] || 'X').toUpperCase();
  const second = parts.length > 1 ? (parts[1][0] || 'X').toUpperCase() : 'X';
  return first + second;
}

export function normalizeCountryCode(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  if (upper === 'USA' || upper === 'US') return 'US';
  if (upper === 'MEX' || upper === 'MX') return 'MX';
  if (upper === 'CAN' || upper === 'CA') return 'CA';
  return upper;
}

export function buildQuoteName(params: {
  mxSalesRep: string;
  ownerName: string;
  accountCode: string;
  createdAt: string;
  sequence: number;
  version: number;
}): string {
  const mxInitials = getInitials(params.mxSalesRep);
  const ownerInitials = getInitials(params.ownerName);

  const code = params.accountCode
    ? params.accountCode.substring(0, 6).toUpperCase().padEnd(6, 'X')
    : 'XXXXXX';

  const date = params.createdAt ? new Date(params.createdAt) : new Date();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const dateStr = `${mm}${dd}${yyyy}`;

  const consecutive = String(params.sequence || 1).padStart(3, '0');
  const ver = String(params.version || 1).padStart(2, '0');

  return `${mxInitials}${ownerInitials}${code}${dateStr}-${consecutive}${ver}`;
}
