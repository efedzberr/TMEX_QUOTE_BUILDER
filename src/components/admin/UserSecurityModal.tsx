import { useEffect, useState } from 'react';
import { X, ShieldAlert, Unlock, Power, Activity, KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SecurityLogPanel, formatDateTime } from './SecurityLogPanel';

interface UserSecurityModalProps {
  userId: string;
  userLabel: string;
  onClose: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface SecurityInfo {
  password_changed_at: string | null;
  must_change_password: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  locked_forever: boolean;
  last_login_at: string | null;
  active_sessions: number;
}

interface ActiveSession { started_at: string; last_activity_at: string }

export function UserSecurityModal({ userId, userLabel, onClose, onToast }: UserSecurityModalProps) {
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [busy, setBusy] = useState<'unlock' | 'end' | 'force' | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    const [{ data: sec }, { data: sess }] = await Promise.all([
      supabase.rpc('admin_get_user_security', { p_user_id: userId }),
      supabase.from('user_sessions').select('started_at, last_activity_at').eq('user_id', userId).is('ended_at', null).order('last_activity_at', { ascending: false }).limit(1),
    ]);
    setInfo((sec as SecurityInfo | null) || null);
    const rows = (sess || []) as ActiveSession[];
    setActive(rows[0] || null);
  };

  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refreshKey]);

  const isLocked = !!info && (info.locked_forever || (!!info.locked_until && new Date(info.locked_until).getTime() > Date.now()));

  const unlock = async () => {
    setBusy('unlock');
    const { error } = await supabase.rpc('admin_unlock_user', { p_user_id: userId });
    setBusy(null);
    if (error) { onToast(error.message, 'error'); return; }
    onToast('User unlocked', 'success');
    setRefreshKey(k => k + 1);
  };

  const forceChange = async () => {
    if (!window.confirm('Require this user to change their password at the next login?')) return;
    setBusy('force');
    const { error } = await supabase.rpc('admin_force_password_change', { p_user_id: userId });
    setBusy(null);
    if (error) { onToast(error.message, 'error'); return; }
    onToast('The user must change their password at the next login', 'success');
    setRefreshKey(k => k + 1);
  };

  const endSessions = async () => {
    if (!window.confirm('End all active sessions for this user? They will have to sign in again.')) return;
    setBusy('end');
    const { data, error } = await supabase.rpc('admin_end_user_sessions', { p_user_id: userId });
    setBusy(null);
    if (error) { onToast(error.message, 'error'); return; }
    onToast(`${data ?? 0} session${data === 1 ? '' : 's'} ended`, 'success');
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl mt-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">Security & Activity</h3>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{userLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            {active ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-gray-900">Online now</span>
                <span className="text-gray-500">since {formatDateTime(active.started_at)} · last activity {formatDateTime(active.last_activity_at)}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="text-gray-600">Offline</span>
                {info?.last_login_at && <span className="text-gray-500">· last login {formatDateTime(info.last_login_at)}</span>}
              </>
            )}
          </div>
          {info && (
            <div className="flex items-center gap-2">
              {isLocked ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {info.locked_forever ? 'Locked until unlocked by an admin' : `Locked until ${formatDateTime(info.locked_until as string)}`}
                </span>
              ) : (
                <span className="text-xs text-gray-500">Failed attempts: {info.failed_login_attempts}</span>
              )}
              {info.password_changed_at && <span className="text-xs text-gray-500">· Password changed {formatDateTime(info.password_changed_at)}</span>}
              {info.must_change_password && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                  <KeyRound className="w-3.5 h-3.5" /> Must change password at next login
                </span>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={unlock} disabled={!isLocked || busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50">
              <Unlock className="w-3.5 h-3.5" /> {busy === 'unlock' ? 'Unlocking…' : 'Unlock'}
            </button>
            <button onClick={forceChange} disabled={!!info?.must_change_password || busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50">
              <KeyRound className="w-3.5 h-3.5" /> {busy === 'force' ? 'Saving…' : 'Force password change'}
            </button>
            <button onClick={endSessions} disabled={!active || busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
              <Power className="w-3.5 h-3.5" /> {busy === 'end' ? 'Ending…' : 'End all sessions'}
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          <SecurityLogPanel userId={userId} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
