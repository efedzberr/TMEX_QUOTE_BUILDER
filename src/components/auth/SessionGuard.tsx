import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { Clock, LogOut, Moon, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

// Kept in localStorage (not sessionStorage) so the app session is shared by every tab and
// survives closing the tab or the browser: on return the server decides if it is still valid.
export const SESSION_STORAGE_KEY = 'sph.session_id';
export const LOGOUT_REASON_KEY = 'sph.logout_reason';
const ACTIVITY_STORAGE_KEY = 'sph.last_activity';

const WARNING_SECONDS = 120;
const TOUCH_INTERVAL_MS = 60_000;
const ACTIVITY_WRITE_MS = 5_000;
const RPC_ATTEMPTS = 3;
const RPC_RETRY_MS = 2_000;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

type ExpireReason = 'timeout' | 'midnight' | 'expired' | 'unverified';

interface TouchResult {
  valid: boolean;
  timeout_minutes: number;
  expires_at?: string;
  /** why the session is not valid: 'timeout' | 'midnight' | 'ended' | 'not_found' | 'stale' */
  reason?: string;
  /** next daily cut-off (midnight); present once the daily sign-out is enabled on the server */
  day_ends_at?: string;
}

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function lsRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function wait(ms: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, ms));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** touch_session with retries. Returns null when the server could not be reached. */
async function touchWithRetry(sid: string): Promise<TouchResult | null> {
  for (let i = 0; i < RPC_ATTEMPTS; i++) {
    const { data, error } = await supabase.rpc('touch_session', { p_session_id: sid });
    if (!error && data) return data as TouchResult;
    if (i < RPC_ATTEMPTS - 1) await wait(RPC_RETRY_MS);
  }
  return null;
}

/** start_session with retries. 'unreachable' = no answer; null id = the server refused the session. */
async function startWithRetry(loginId: number | null): Promise<{ id: string | null } | 'unreachable'> {
  for (let i = 0; i < RPC_ATTEMPTS; i++) {
    const { data, error } = await supabase.rpc('start_session', { p_login_id: loginId });
    if (!error) return { id: (data as string | null) || null };
    if (i < RPC_ATTEMPTS - 1) await wait(RPC_RETRY_MS);
  }
  return 'unreachable';
}

/**
 * Wraps the authenticated app. Tracks inactivity against the profile's session timeout
 * (shared by all tabs), warns 2 minutes before expiry and signs the user out when it elapses.
 * Also enforces the daily cut-off (midnight) reported by the server. If the session cannot be
 * verified with the server, the user is signed out (fail closed).
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const { status, signOut } = useAuth();
  const [timeoutMinutes, setTimeoutMinutes] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null); // seconds left, only while warning
  const [midnightLeft, setMidnightLeft] = useState<number | null>(null); // seconds to the daily cut-off

  const sessionIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastActivityWriteRef = useRef<number>(0);
  const lastTouchRef = useRef<number>(0);
  const activitySinceTouchRef = useRef<boolean>(false);
  const warningRef = useRef<boolean>(false);
  const expiringRef = useRef<boolean>(false);
  const dayEndsAtRef = useRef<number | null>(null);
  const midnightDismissedRef = useRef<boolean>(false);

  const markActivity = useCallback((force = false) => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (force || now - lastActivityWriteRef.current >= ACTIVITY_WRITE_MS) {
      lastActivityWriteRef.current = now;
      lsSet(ACTIVITY_STORAGE_KEY, String(now)); // lets the other tabs see this activity
    }
  }, []);

  const applyTouch = useCallback((r: TouchResult) => {
    if (r.timeout_minutes) setTimeoutMinutes(r.timeout_minutes);
    const ends = r.day_ends_at ? Date.parse(r.day_ends_at) : NaN;
    dayEndsAtRef.current = Number.isNaN(ends) ? null : ends;
  }, []);

  const expire = useCallback(async (reason: ExpireReason) => {
    if (expiringRef.current) return;
    expiringRef.current = true;
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    lsRemove(SESSION_STORAGE_KEY);
    lsSet(LOGOUT_REASON_KEY, reason);
    if (sid && (reason === 'timeout' || reason === 'midnight')) {
      try { await supabase.rpc('end_session', { p_session_id: sid, p_reason: reason }); } catch { /* ignore */ }
    }
    await signOut();
  }, [signOut]);

  const touch = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    lastTouchRef.current = Date.now();
    activitySinceTouchRef.current = false;
    const { data, error } = await supabase.rpc('touch_session', { p_session_id: sid });
    if (error) return; // transient error: keep the local timer running
    const r = data as TouchResult | null;
    if (!r) return;
    if (!r.valid) { await expire(r.reason === 'midnight' ? 'midnight' : 'timeout'); return; }
    applyTouch(r);
  }, [expire, applyTouch]);

  // Start or resume the session once authenticated
  useEffect(() => {
    if (status !== 'authenticated') {
      sessionIdRef.current = null;
      dayEndsAtRef.current = null;
      midnightDismissedRef.current = false;
      setTimeoutMinutes(null);
      setRemaining(null);
      setMidnightLeft(null);
      warningRef.current = false;
      expiringRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const adopt = (sid: string, r: TouchResult) => {
        sessionIdRef.current = sid;
        lsSet(SESSION_STORAGE_KEY, sid);
        lsRemove(LOGOUT_REASON_KEY);
        applyTouch(r);
        if (!r.timeout_minutes) setTimeoutMinutes(120);
        markActivity(true);
        lastTouchRef.current = Date.now();
      };

      const existing = lsGet(SESSION_STORAGE_KEY);
      if (existing) {
        const r = await touchWithRetry(existing);
        if (cancelled) return;
        if (!r) { await expire('unverified'); return; }
        if (r.valid) { adopt(existing, r); return; }
        // 'not_found' / 'stale': the stored id belongs to another login; the server decides below
        // whether this login may start a session. Anything else means the session is over.
        if (r.reason !== 'not_found' && r.reason !== 'stale') {
          await expire(r.reason === 'midnight' ? 'midnight' : 'timeout');
          return;
        }
        lsRemove(SESSION_STORAGE_KEY);
      }

      const loginIdRaw = sessionStorage.getItem('sph.login_id');
      sessionStorage.removeItem('sph.login_id');
      const started = await startWithRetry(loginIdRaw ? Number(loginIdRaw) : null);
      if (cancelled) return;
      if (started === 'unreachable') { await expire('unverified'); return; }
      if (!started.id) { await expire('expired'); return; } // refused: inactive too long or past the daily cut-off
      const r = await touchWithRetry(started.id);
      if (cancelled) return;
      if (!r) { await expire('unverified'); return; }
      if (!r.valid) { await expire(r.reason === 'midnight' ? 'midnight' : 'expired'); return; }
      adopt(started.id, r);
    })();
    return () => { cancelled = true; };
  }, [status, expire, applyTouch, markActivity]);

  // Activity listeners
  useEffect(() => {
    if (status !== 'authenticated') return;
    const onActivity = () => {
      if (warningRef.current) return; // during the warning only the button extends
      markActivity();
      activitySinceTouchRef.current = true;
    };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
    return () => { for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity); };
  }, [status, markActivity]);

  // 1-second ticker: daily cut-off, countdown, warning, expiry and periodic server touch
  useEffect(() => {
    if (status !== 'authenticated' || !timeoutMinutes) return;
    const id = window.setInterval(() => {
      const now = Date.now();

      // Daily cut-off (midnight)
      const dayEnds = dayEndsAtRef.current;
      if (dayEnds) {
        const msLeft = dayEnds - now;
        if (msLeft <= 0) { void expire('midnight'); return; }
        if (msLeft <= WARNING_SECONDS * 1000 && !midnightDismissedRef.current) setMidnightLeft(Math.ceil(msLeft / 1000));
        else setMidnightLeft(null);
      }

      // Activity in any other tab counts for this one too
      const shared = Number(lsGet(ACTIVITY_STORAGE_KEY) || 0);
      if (shared > lastActivityRef.current) lastActivityRef.current = shared;

      const idleSeconds = (now - lastActivityRef.current) / 1000;
      const left = timeoutMinutes * 60 - idleSeconds;
      if (left <= 0) { void expire('timeout'); return; }
      if (left <= WARNING_SECONDS) {
        warningRef.current = true;
        setRemaining(Math.ceil(left));
        return;
      }
      if (warningRef.current) { // extended from another tab
        warningRef.current = false;
        setRemaining(null);
      }
      if (activitySinceTouchRef.current && now - lastTouchRef.current >= TOUCH_INTERVAL_MS) {
        void touch();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, timeoutMinutes, expire, touch]);

  const extend = async () => {
    markActivity(true);
    warningRef.current = false;
    setRemaining(null);
    await touch();
  };

  const signOutNow = async () => {
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    lsRemove(SESSION_STORAGE_KEY);
    if (sid) {
      try { await supabase.rpc('end_session', { p_session_id: sid, p_reason: 'logout' }); } catch { /* ignore */ }
    }
    await signOut();
  };

  const dismissMidnight = () => {
    midnightDismissedRef.current = true;
    setMidnightLeft(null);
  };

  return (
    <>
      {children}
      {status === 'authenticated' && remaining !== null && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Your session is about to expire</h3>
                <p className="text-sm text-gray-500">You have been inactive for a while.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              You will be signed out in <span className="font-semibold tabular-nums">{formatCountdown(remaining)}</span>.
              Unsaved changes will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={signOutNow}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
              <button
                onClick={extend}
                autoFocus
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4" /> Extend session
              </button>
            </div>
          </div>
        </div>
      )}
      {status === 'authenticated' && remaining === null && midnightLeft !== null && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Moon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Sessions end at midnight</h3>
                <p className="text-sm text-gray-500">For security, everyone signs in again each day.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              You will be signed out in <span className="font-semibold tabular-nums">{formatCountdown(midnightLeft)}</span>.
              Save your work now; unsaved changes will be lost.
            </p>
            <div className="flex justify-end">
              <button
                onClick={dismissMidnight}
                autoFocus
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
