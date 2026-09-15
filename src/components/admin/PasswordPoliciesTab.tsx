import { useEffect, useState } from 'react';
import { KeyRound, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/permissions';
import { COMPLEXITY_LABELS, DEFAULT_POLICY, type Complexity, type PasswordPolicy } from '../../lib/passwordPolicy';

interface PasswordPoliciesTabProps { onToast: (message: string, type: 'success' | 'error') => void }

interface PolicyRow extends PasswordPolicy { updated_at: string | null; updated_by: string | null }

const EXPIRATION_OPTIONS: { value: number | null; label: string }[] = [
  { value: 30, label: '30 days' }, { value: 60, label: '60 days' }, { value: 90, label: '90 days' },
  { value: 180, label: '180 days' }, { value: 365, label: 'One year' }, { value: null, label: 'Never expires' },
];
const MIN_LENGTH_OPTIONS = [8, 10, 12, 15];
const ATTEMPT_OPTIONS: { value: number | null; label: string }[] = [
  { value: 3, label: '3' }, { value: 5, label: '5' }, { value: 10, label: '10' }, { value: null, label: 'No limit' },
];
const LOCKOUT_OPTIONS: { value: number | null; label: string }[] = [
  { value: 15, label: '15 minutes' }, { value: 30, label: '30 minutes' }, { value: 60, label: '60 minutes' },
  { value: null, label: 'Forever (must be reset by admin)' },
];

const nullable = (v: string): number | null => (v === '' ? null : Number(v));
const str = (v: number | null): string => (v === null ? '' : String(v));

export function PasswordPoliciesTab({ onToast }: PasswordPoliciesTabProps) {
  const { isAdmin } = usePermissions();
  const [saved, setSaved] = useState<PolicyRow | null>(null);
  const [draft, setDraft] = useState<PasswordPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedByName, setUpdatedByName] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('password_policies').select('*').eq('id', 1).maybeSingle();
    if (error || !data) { onToast(error?.message || 'Could not load password policies', 'error'); setLoading(false); return; }
    const row = data as PolicyRow;
    setSaved(row);
    setDraft({ ...DEFAULT_POLICY, ...row });
    if (row.updated_by) {
      const { data: u } = await supabase.from('user_profiles').select('display_name').eq('id', row.updated_by).maybeSingle();
      setUpdatedByName((u as { display_name: string | null } | null)?.display_name || null);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = !!saved && (
    saved.expiration_days !== draft.expiration_days || saved.history_count !== draft.history_count ||
    saved.min_length !== draft.min_length || saved.complexity !== draft.complexity ||
    saved.max_login_attempts !== draft.max_login_attempts || saved.lockout_minutes !== draft.lockout_minutes ||
    saved.disallow_username !== draft.disallow_username
  );

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('password_policies').update({
      expiration_days: draft.expiration_days,
      history_count: draft.history_count,
      min_length: draft.min_length,
      complexity: draft.complexity,
      max_login_attempts: draft.max_login_attempts,
      lockout_minutes: draft.lockout_minutes,
      disallow_username: draft.disallow_username,
    }).eq('id', 1);
    setSaving(false);
    if (error) { onToast(error.message, 'error'); return; }
    onToast('Password policies saved', 'success');
    await load();
  };

  const handleCancel = () => { if (saved) setDraft({ ...DEFAULT_POLICY, ...saved }); };

  const selectClass = 'px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 min-w-[260px]';
  const Row = ({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-2 md:gap-6 px-4 py-3 border-b border-gray-100 last:border-b-0 items-start">
      <div>
        <div className="text-sm text-gray-800">{label}</div>
        {help && <div className="text-xs text-gray-500 mt-0.5">{help}</div>}
      </div>
      <div>{children}</div>
    </div>
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Password Policies</h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Organization-wide rules for every user's password. Changes apply to new passwords and to the next login; existing passwords are not invalidated until they expire.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleCancel} disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <Row label="User passwords expire in" help="Users must change their password when it expires.">
            <select value={str(draft.expiration_days)} onChange={e => setDraft({ ...draft, expiration_days: nullable(e.target.value) })} disabled={!isAdmin} className={selectClass}>
              {EXPIRATION_OPTIONS.map(o => <option key={o.label} value={str(o.value)}>{o.label}</option>)}
            </select>
          </Row>
          <Row label="Enforce password history" help="Number of previous passwords a user cannot reuse.">
            <select value={draft.history_count} onChange={e => setDraft({ ...draft, history_count: Number(e.target.value) })} disabled={!isAdmin} className={selectClass}>
              {Array.from({ length: 25 }, (_, i) => i).map(n => <option key={n} value={n}>{n === 0 ? 'No passwords remembered' : `${n} password${n === 1 ? '' : 's'} remembered`}</option>)}
            </select>
          </Row>
          <Row label="Minimum password length">
            <select value={draft.min_length} onChange={e => setDraft({ ...draft, min_length: Number(e.target.value) })} disabled={!isAdmin} className={selectClass}>
              {MIN_LENGTH_OPTIONS.map(n => <option key={n} value={n}>{n} characters</option>)}
            </select>
          </Row>
          <Row label="Password complexity requirement">
            <select value={draft.complexity} onChange={e => setDraft({ ...draft, complexity: e.target.value as Complexity })} disabled={!isAdmin} className={selectClass}>
              {(Object.keys(COMPLEXITY_LABELS) as Complexity[]).map(c => <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>)}
            </select>
          </Row>
          <Row label="Password cannot contain username" help="The part of the email before @.">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={draft.disallow_username} onChange={e => setDraft({ ...draft, disallow_username: e.target.checked })} disabled={!isAdmin}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Enabled
            </label>
          </Row>
          <Row label="Maximum invalid login attempts" help="Consecutive failed attempts before the account is locked.">
            <select value={str(draft.max_login_attempts)} onChange={e => setDraft({ ...draft, max_login_attempts: nullable(e.target.value) })} disabled={!isAdmin} className={selectClass}>
              {ATTEMPT_OPTIONS.map(o => <option key={o.label} value={str(o.value)}>{o.label}</option>)}
            </select>
          </Row>
          <Row label="Lockout effective period">
            <select value={str(draft.lockout_minutes)} onChange={e => setDraft({ ...draft, lockout_minutes: nullable(e.target.value) })} disabled={!isAdmin} className={selectClass}>
              {LOCKOUT_OPTIONS.map(o => <option key={o.label} value={str(o.value)}>{o.label}</option>)}
            </select>
          </Row>
        </div>
      )}

      {saved?.updated_at && (
        <p className="mt-2 text-xs text-gray-400">
          Last modified {new Date(saved.updated_at).toLocaleString('en-US')}{updatedByName ? ` by ${updatedByName}` : ''}.
        </p>
      )}
    </div>
  );
}
