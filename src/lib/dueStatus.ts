import type { Quote } from './supabase';

export type DueStatusKey = 'on_time' | 'due_soon' | 'overdue' | 'closed' | 'none';

export interface DueStatusInfo {
  key: DueStatusKey;
  label: string;
  /** days until due (negative = past due); null when no due date */
  daysLeft: number | null;
}

/** Stages where the clock stops (quote already reached the customer). */
export const DUE_CLOCK_STOPPED_STAGES = ['Sent to Customer', 'Published'];

export const DUE_STATUS_LABELS: Record<DueStatusKey, string> = {
  on_time: 'On time',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  closed: 'Closed',
  none: '—',
};

/** Parse a 'YYYY-MM-DD' date as a LOCAL date (avoids the UTC off-by-one of new Date('YYYY-MM-DD')). */
export function parseLocalDate(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Format a 'YYYY-MM-DD' date as 'SEP / 04 / 2026' (same look as the header dates). */
export function formatLocalDate(value?: string | null): string {
  const d = parseLocalDate(value);
  if (!d) return '—';
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return `${month} / ${String(d.getDate()).padStart(2, '0')} / ${d.getFullYear()}`;
}

export function getDueStatus(quote: Pick<Quote, 'due_date' | 'due_warning_days' | 'stage'>, now: Date = new Date()): DueStatusInfo {
  const due = parseLocalDate(quote.due_date);
  if (!due) return { key: 'none', label: DUE_STATUS_LABELS.none, daysLeft: null };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (DUE_CLOCK_STOPPED_STAGES.includes(quote.stage || '')) return { key: 'closed', label: DUE_STATUS_LABELS.closed, daysLeft };
  if (daysLeft < 0) return { key: 'overdue', label: DUE_STATUS_LABELS.overdue, daysLeft };
  const warn = quote.due_warning_days ?? 1;
  if (daysLeft <= warn) return { key: 'due_soon', label: DUE_STATUS_LABELS.due_soon, daysLeft };
  return { key: 'on_time', label: DUE_STATUS_LABELS.on_time, daysLeft };
}
