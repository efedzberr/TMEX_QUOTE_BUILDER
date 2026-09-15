import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

export const SESSION_STORAGE_KEY = 'sph.session_id';
export const LOGOUT_REASON_KEY = 'sph.logout_reason';

const WARNING_SECONDS = 120;
const TOUCH_INTERVAL_MS = 60_000;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

interface TouchResult { valid: boolean; timeout_minutes: number; expires_at?: string }

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Wraps the authenticated app. Tracks inactivity against the profile's session timeout,
 * warns 2 minutes before expiry and signs the user out when it elapses.
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const { status, signOut } = useAuth();
  const [timeoutMinutes, setTimeoutMinutes] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null); // seconds left, only while warning

  const sessionIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastTouchRef = useRef<number>(0);
  const activitySinceTouchRef = useRef<boolean>(false);
  const warningRef = useRef<boolean>(false);
  const expiringRef = useRef<boolean>(false);

  const expire = useCallback(async () => {
    if (expiringRef.current) return;
    expiringRef.current = true;
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.setItem(LOGOUT_REASON_KEY, 'timeout');
    if (sid) {
      try { await supabase.rpc('end_session', { p_session_id: sid, p_reason: 'timeout' }); } catch { /* ignore */ }
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
    if (!r.valid) { await expire(); return; }
    if (r.timeout_minutes) setTimeoutMinutes(r.timeout_minutes);
  }, [expire]);

  // Start or resume the session once authenticated
  useEffect(() => {
    if (status !== 'authenticated') {
      sessionIdRef.current = null;
      setTimeoutMinutes(null);
      setRemaining(null);
      warningRef.current = false;
      expiringRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        const { data } = await supabase.rpc('touch_session', { p_session_id: existing });
        const r = data as TouchResult | null;
        if (cancelled) return;
        if (r?.valid) {
          sessionIdRef.current = existing;
          setTimeoutMinutes(r.timeout_minutes);
          lastActivityRef.current = Date.now();
          lastTouchRef.current = Date.now();
          return;
        }
        if (r && !r.valid) { await expire(); return; } // expired while the tab was away
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
      const { data: sid, error } = await supabase.rpc('start_session');
      if (cancelled || error || !sid) return;
      sessionIdRef.current = sid as string;
      sessionStorage.setItem(SESSION_STORAGE_KEY, sid as string);
      lastActivityRef.current = Date.now();
      const { data: t } = await supabase.rpc('touch_session', { p_session_id: sid });
      const r = t as TouchResult | null;
      if (!cancelled) {
        setTimeoutMinutes(r?.timeout_minutes ?? 120);
        lastTouchRef.current = Date.now();
      }
    })();
    return () => { cancelled = true; };
  }, [status, expire]);

  // Activity listeners
  useEffect(() => {
    if (status !== 'authenticated') return;
    const onActivity = () => {
      if (warningRef.current) return; // during the warning only the button extends
      lastActivityRef.current = Date.now();
      activitySinceTouchRef.current = true;
    };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
    return () => { for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity); };
  }, [status]);

  // 1-second ticker: countdown, warning, expiry and periodic server touch
  useEffect(() => {
    if (status !== 'authenticated' || !timeoutMinutes) return;
    const id = window.setInterval(() => {
      const idleSeconds = (Date.now() - lastActivityRef.current) / 1000;
      const left = timeoutMinutes * 60 - idleSeconds;
      if (left <= 0) { void expire(); return; }
      if (left <= WARNING_SECONDS) {
        warningRef.current = true;
        setRemaining(Math.ceil(left));
        return;
      }
      if (activitySinceTouchRef.current && Date.now() - lastTouchRef.current >= TOUCH_INTERVAL_MS) {
        void touch();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, timeoutMinutes, expire, touch]);

  const extend = async () => {
    lastActivityRef.current = Date.now();
    warningRef.current = false;
    setRemaining(null);
    await touch();
  };

  const signOutNow = async () => {
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    if (sid) {
      try { await supabase.rpc('end_session', { p_session_id: sid, p_reason: 'logout' }); } catch { /* ignore */ }
    }
    await signOut();
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
    </>
  );
}
