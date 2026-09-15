import { useEffect, useMemo, useState, FormEvent } from 'react';
import { KeyRound, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { DEFAULT_POLICY, evaluatePassword, fetchPasswordPolicy, changePassword, type PasswordPolicy } from '../../lib/passwordPolicy';
import { PasswordRules } from './PasswordRules';

interface ChangePasswordModalProps {
  onClose: () => void;
  onChanged: () => void;
  /** Forced change: the user cannot dismiss the modal. */
  forced?: boolean;
}

export function ChangePasswordModal({ onClose, onChanged, forced = false }: ChangePasswordModalProps) {
  const { userEmail } = useAuth();
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_POLICY);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchPasswordPolicy().then(setPolicy); }, []);

  const rules = useMemo(() => evaluatePassword(password, policy, userEmail), [password, policy, userEmail]);
  const valid = rules.every(r => r.ok) && password === confirm && current.length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) { setError(password !== confirm ? 'Las contrase\u00f1as no coinciden' : 'La contrase\u00f1a no cumple las reglas'); return; }
    setLoading(true);
    setError(null);
    const res = await changePassword(password, current);
    setLoading(false);
    if (!res.ok) {
      if (res.error === 'Current password is incorrect') setError('La contrase\u00f1a actual es incorrecta.');
      else if (res.failed_rules?.includes('history')) setError(`No puedes reutilizar ninguna de tus \u00faltimas ${policy.history_count} contrase\u00f1as.`);
      else setError(res.error || 'No fue posible cambiar la contrase\u00f1a.');
      return;
    }
    onChanged();
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={forced ? undefined : onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">{forced ? 'Debes cambiar tu contrase\u00f1a' : 'Cambiar contrase\u00f1a'}</h3>
              {forced && <p className="text-sm text-gray-500 mt-0.5">Tu contrase\u00f1a expir\u00f3 o un administrador solicit\u00f3 el cambio.</p>}
            </div>
          </div>
          {!forced && <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>}
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contrase\u00f1a actual</label>
            <input type={show ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contrase\u00f1a</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className={`${inputClass} pr-10`} required />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-2"><PasswordRules rules={rules} touched={password.length > 0} /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contrase\u00f1a</label>
            <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className={inputClass} required />
            {confirm.length > 0 && password !== confirm && <p className="mt-1 text-xs text-red-600">Las contrase\u00f1as no coinciden</p>}
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            {!forced && (
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
            )}
            <button type="submit" disabled={!valid || loading} className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Guardando…' : 'Cambiar contrase\u00f1a'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
