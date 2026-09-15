import { supabase } from './supabase';

export interface ActivityOptions {
  object?: string;
  recordId?: string | null;
  recordLabel?: string | null;
  details?: string | null;
}

/**
 * Records a business event for the current user in user_activity_log.
 * Fire-and-forget: never throws, never blocks the UI.
 */
export function logActivity(event: string, opts: ActivityOptions = {}): void {
  let sessionId: string | null = null;
  try { sessionId = sessionStorage.getItem('sph.session_id'); } catch { /* ignore */ }
  void supabase
    .rpc('log_activity', {
      p_event: event,
      p_object: opts.object ?? null,
      p_record_id: opts.recordId ?? null,
      p_record_label: opts.recordLabel ?? null,
      p_details: opts.details ?? null,
      p_session_id: sessionId,
    })
    .then(({ error }) => { if (error) console.warn('[activity]', event, error.message); });
}
