import type { Quote } from './supabase';

export const QUOTE_STATUSES = ['Active', 'On Hold', 'Waiting for Information', 'Cancelled'] as const;
export type QuoteStatus = typeof QUOTE_STATUSES[number];

export type ClockState = 'effective' | 'paused' | 'closed';

export interface TimeMetrics {
  state: ClockState;
  /** Won (Published), Lost (Cancelled) or null when open */
  closedAs: 'won' | 'lost' | null;
  ageDays: number;
  totalSeconds: number;
  effectiveSeconds: number;
  pausedSeconds: number;
  /** seconds in the current state */
  currentStateSeconds: number;
}

/** Same rules as the DB function quote_clock_state(). */
export function deriveClockState(stage?: string | null, status?: string | null): ClockState {
  if (status === 'Cancelled' || stage === 'Published') return 'closed';
  if (status === 'On Hold' || status === 'Waiting for Information') return 'paused';
  return 'effective';
}

export function getTimeMetrics(
  quote: Pick<Quote, 'created_at' | 'closed_at' | 'clock_state' | 'clock_since' | 'effective_seconds' | 'paused_seconds' | 'stage' | 'status'>,
  now: Date = new Date(),
): TimeMetrics {
  const created = new Date(quote.created_at);
  const state = (quote.clock_state as ClockState) || deriveClockState(quote.stage, quote.status);
  const closedAt = quote.closed_at ? new Date(quote.closed_at) : null;
  const end = state === 'closed' && closedAt ? closedAt : now;
  const since = quote.clock_since ? new Date(quote.clock_since) : created;
  const running = state === 'closed' ? 0 : Math.max(0, (now.getTime() - since.getTime()) / 1000);
  const totalSeconds = Math.max(0, (end.getTime() - created.getTime()) / 1000);
  return {
    state,
    closedAs: state === 'closed' ? (quote.status === 'Cancelled' ? 'lost' : 'won') : null,
    ageDays: Math.floor(totalSeconds / 86400),
    totalSeconds,
    effectiveSeconds: (quote.effective_seconds || 0) + (state === 'effective' ? running : 0),
    pausedSeconds: (quote.paused_seconds || 0) + (state === 'paused' ? running : 0),
    currentStateSeconds: state === 'closed' && closedAt ? Math.max(0, (now.getTime() - closedAt.getTime()) / 1000) : running,
  };
}

/** 195000 -> "2d 6h 10m"; values under a minute -> "0m" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (d > 0 || h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

/** Hours with one decimal, for list columns and filters. */
export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}
