export type RelativeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface RelativeToken {
  token: string;
  label: string;
  unit: RelativeUnit;
  takesN: boolean;
}

export interface RelativeValue {
  token: string;
  n?: number;
}

export const RELATIVE_TOKEN_CATALOG: RelativeToken[] = [
  // Day
  { token: 'TODAY', label: 'Today', unit: 'day', takesN: false },
  { token: 'YESTERDAY', label: 'Yesterday', unit: 'day', takesN: false },
  { token: 'TOMORROW', label: 'Tomorrow', unit: 'day', takesN: false },
  { token: 'LAST_N_DAYS', label: 'Last N days', unit: 'day', takesN: true },
  { token: 'NEXT_N_DAYS', label: 'Next N days', unit: 'day', takesN: true },
  { token: 'N_DAYS_AGO', label: 'N days ago', unit: 'day', takesN: true },
  // Week
  { token: 'THIS_WEEK', label: 'This week', unit: 'week', takesN: false },
  { token: 'LAST_WEEK', label: 'Last week', unit: 'week', takesN: false },
  { token: 'NEXT_WEEK', label: 'Next week', unit: 'week', takesN: false },
  { token: 'LAST_N_WEEKS', label: 'Last N weeks', unit: 'week', takesN: true },
  { token: 'NEXT_N_WEEKS', label: 'Next N weeks', unit: 'week', takesN: true },
  { token: 'N_WEEKS_AGO', label: 'N weeks ago', unit: 'week', takesN: true },
  // Month
  { token: 'THIS_MONTH', label: 'This month', unit: 'month', takesN: false },
  { token: 'LAST_MONTH', label: 'Last month', unit: 'month', takesN: false },
  { token: 'NEXT_MONTH', label: 'Next month', unit: 'month', takesN: false },
  { token: 'LAST_N_MONTHS', label: 'Last N months', unit: 'month', takesN: true },
  { token: 'NEXT_N_MONTHS', label: 'Next N months', unit: 'month', takesN: true },
  { token: 'N_MONTHS_AGO', label: 'N months ago', unit: 'month', takesN: true },
  // Quarter
  { token: 'THIS_QUARTER', label: 'This quarter', unit: 'quarter', takesN: false },
  { token: 'LAST_QUARTER', label: 'Last quarter', unit: 'quarter', takesN: false },
  { token: 'NEXT_QUARTER', label: 'Next quarter', unit: 'quarter', takesN: false },
  { token: 'LAST_N_QUARTERS', label: 'Last N quarters', unit: 'quarter', takesN: true },
  { token: 'NEXT_N_QUARTERS', label: 'Next N quarters', unit: 'quarter', takesN: true },
  { token: 'N_QUARTERS_AGO', label: 'N quarters ago', unit: 'quarter', takesN: true },
  // Year
  { token: 'THIS_YEAR', label: 'This year', unit: 'year', takesN: false },
  { token: 'LAST_YEAR', label: 'Last year', unit: 'year', takesN: false },
  { token: 'NEXT_YEAR', label: 'Next year', unit: 'year', takesN: false },
  { token: 'LAST_N_YEARS', label: 'Last N years', unit: 'year', takesN: true },
  { token: 'NEXT_N_YEARS', label: 'Next N years', unit: 'year', takesN: true },
  { token: 'N_YEARS_AGO', label: 'N years ago', unit: 'year', takesN: true },
];

export const RELATIVE_TOKEN_MAP = new Map(RELATIVE_TOKEN_CATALOG.map(t => [t.token, t]));

export const RELATIVE_TOKENS_BY_UNIT: Record<RelativeUnit, RelativeToken[]> = {
  day: RELATIVE_TOKEN_CATALOG.filter(t => t.unit === 'day'),
  week: RELATIVE_TOKEN_CATALOG.filter(t => t.unit === 'week'),
  month: RELATIVE_TOKEN_CATALOG.filter(t => t.unit === 'month'),
  quarter: RELATIVE_TOKEN_CATALOG.filter(t => t.unit === 'quarter'),
  year: RELATIVE_TOKEN_CATALOG.filter(t => t.unit === 'year'),
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function mondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(d), diff);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function quarterStart(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function addQuarters(d: Date, n: number): Date {
  const qs = quarterStart(d);
  return new Date(qs.getFullYear(), qs.getMonth() + n * 3, 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function addYears(d: Date, n: number): Date {
  return new Date(d.getFullYear() + n, 0, 1);
}

export function resolveRelativeRange(token: string, n: number, now: Date = new Date()): { start: Date; end: Date } {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  switch (token) {
    // Day
    case 'TODAY':
      return { start: today, end: tomorrow };
    case 'YESTERDAY':
      return { start: addDays(today, -1), end: today };
    case 'TOMORROW':
      return { start: tomorrow, end: addDays(today, 2) };
    case 'LAST_N_DAYS':
      return { start: addDays(today, -n), end: tomorrow };
    case 'NEXT_N_DAYS':
      return { start: today, end: addDays(today, n + 1) };
    case 'N_DAYS_AGO': {
      const d = addDays(today, -n);
      return { start: d, end: addDays(d, 1) };
    }

    // Week
    case 'THIS_WEEK': {
      const mon = mondayOfWeek(today);
      return { start: mon, end: addDays(mon, 7) };
    }
    case 'LAST_WEEK': {
      const mon = mondayOfWeek(today);
      return { start: addDays(mon, -7), end: mon };
    }
    case 'NEXT_WEEK': {
      const mon = mondayOfWeek(today);
      return { start: addDays(mon, 7), end: addDays(mon, 14) };
    }
    case 'LAST_N_WEEKS': {
      const mon = mondayOfWeek(today);
      return { start: addDays(mon, -n * 7), end: mon };
    }
    case 'NEXT_N_WEEKS': {
      const mon = mondayOfWeek(today);
      const nextMon = addDays(mon, 7);
      return { start: nextMon, end: addDays(nextMon, n * 7) };
    }
    case 'N_WEEKS_AGO': {
      const mon = mondayOfWeek(today);
      const target = addDays(mon, -n * 7);
      return { start: target, end: addDays(target, 7) };
    }

    // Month
    case 'THIS_MONTH':
      return { start: startOfMonth(today), end: addMonths(today, 1) };
    case 'LAST_MONTH':
      return { start: addMonths(today, -1), end: startOfMonth(today) };
    case 'NEXT_MONTH':
      return { start: addMonths(today, 1), end: addMonths(today, 2) };
    case 'LAST_N_MONTHS':
      return { start: addMonths(today, -n), end: startOfMonth(today) };
    case 'NEXT_N_MONTHS': {
      const nextMonth = addMonths(today, 1);
      return { start: nextMonth, end: addMonths(today, n + 1) };
    }
    case 'N_MONTHS_AGO': {
      const s = addMonths(today, -n);
      return { start: s, end: addMonths(today, -(n - 1)) };
    }

    // Quarter
    case 'THIS_QUARTER':
      return { start: quarterStart(today), end: addQuarters(today, 1) };
    case 'LAST_QUARTER':
      return { start: addQuarters(today, -1), end: quarterStart(today) };
    case 'NEXT_QUARTER':
      return { start: addQuarters(today, 1), end: addQuarters(today, 2) };
    case 'LAST_N_QUARTERS':
      return { start: addQuarters(today, -n), end: quarterStart(today) };
    case 'NEXT_N_QUARTERS': {
      const nextQ = addQuarters(today, 1);
      return { start: nextQ, end: addQuarters(today, n + 1) };
    }
    case 'N_QUARTERS_AGO': {
      const s = addQuarters(today, -n);
      return { start: s, end: addQuarters(today, -(n - 1)) };
    }

    // Year
    case 'THIS_YEAR':
      return { start: startOfYear(today), end: addYears(today, 1) };
    case 'LAST_YEAR':
      return { start: addYears(today, -1), end: startOfYear(today) };
    case 'NEXT_YEAR':
      return { start: addYears(today, 1), end: addYears(today, 2) };
    case 'LAST_N_YEARS':
      return { start: addYears(today, -n), end: startOfYear(today) };
    case 'NEXT_N_YEARS': {
      const nextY = addYears(today, 1);
      return { start: nextY, end: addYears(today, n + 1) };
    }
    case 'N_YEARS_AGO': {
      const s = addYears(today, -n);
      return { start: s, end: addYears(today, -(n - 1)) };
    }

    default:
      return { start: today, end: tomorrow };
  }
}

export function formatRelativeLabel(rel: RelativeValue): string {
  const def = RELATIVE_TOKEN_MAP.get(rel.token);
  if (!def) return rel.token;
  if (!def.takesN) return def.label.toLowerCase();
  const n = rel.n ?? 1;
  return def.label.toLowerCase().replace('n', String(n));
}

export function isValidRelativeN(n: unknown): boolean {
  if (n == null) return false;
  const num = typeof n === 'number' ? n : parseInt(String(n), 10);
  return Number.isInteger(num) && num > 0;
}

export function parseRelativeValue(raw: string): RelativeValue | null {
  if (!raw.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && RELATIVE_TOKEN_MAP.has(parsed.token)) {
      return { token: parsed.token, n: parsed.n };
    }
  } catch { /* not relative */ }
  return null;
}

export function serializeRelativeValue(rel: RelativeValue): string {
  return JSON.stringify(rel);
}
