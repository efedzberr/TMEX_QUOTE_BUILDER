import { useState, useEffect } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const ACCOUNT_TYPE_OPTIONS = ['Direct Customer', 'Transportation Company'];

export interface CreatedAccount {
  id: string;
  account_name: string;
  account_code: string;
  type: string;
  status: string;
  bill_to_name: string | null;
  shipper_name: string | null;
}

interface DuplicateMatch {
  id: string;
  account_name: string;
  account_code: string;
  type: string;
  status: string;
  match_kind: 'name' | 'code' | 'similar';
}

interface NewAccountModalProps {
  isOpen: boolean;
  initialName: string;
  /** When set, the Account Type is fixed to this value (used by the BCO field) */
  lockedType?: string;
  onClose: () => void;
  onCreated: (account: CreatedAccount) => void;
}

export function NewAccountModal({ isOpen, initialName, lockedType, onClose, onCreated }: NewAccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setType(lockedType || '');
      setCode('');
      setEmail('');
      setMatches([]);
      setErrors({});
      setSaveError('');
    }
  }, [isOpen, initialName, lockedType]);

  useEffect(() => {
    if (!isOpen) return;
    if (!name.trim() && !code.trim()) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('find_account_duplicates', {
        p_name: name,
        p_code: code,
        p_exclude_id: null,
      });
      if (cancelled) return;
      setMatches(error || !data ? [] : (data as DuplicateMatch[]));
      setChecking(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, name, code]);

  if (!isOpen) return null;

  const nameMatch = matches.find(m => m.match_kind === 'name');
  const codeMatch = matches.find(m => m.match_kind === 'code');
  const similar = matches.filter(m => m.match_kind === 'similar');
  const blocked = !!nameMatch || !!codeMatch;

  const handleCreate = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    if (!type) e.type = 'Required';
    setErrors(e);
    if (Object.keys(e).length > 0 || blocked || checking) return;

    setSaving(true);
    setSaveError('');
    const { data, error } = await supabase.rpc('create_account_with_children', {
      p_account_name: name,
      p_type: type,
      p_account_code: code,
      p_status: 'Active',
      p_customer_email: email,
    });
    setSaving(false);
    if (error || !data) {
      setSaveError(error?.message || 'The account could not be created.');
      return;
    }
    onCreated(data as CreatedAccount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Account</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              autoFocus
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name || nameMatch ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.name && <div className="text-red-600 text-xs mt-1">{errors.name}</div>}
            {nameMatch && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  This account already exists: <span className="font-semibold">{nameMatch.account_name}</span>
                  {nameMatch.account_code ? ` (${nameMatch.account_code})` : ''} · {nameMatch.type} · {nameMatch.status}.
                  Close this window and select it from the list.
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Type <span className="text-red-600">*</span>
            </label>
            <select
              value={type}
              disabled={!!lockedType}
              onChange={e => { setType(e.target.value); if (errors.type) setErrors(prev => ({ ...prev, type: '' })); }}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 ${errors.type ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select...</option>
              {ACCOUNT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.type && <div className="text-red-600 text-xs mt-1">{errors.type}</div>}
            {lockedType && <div className="text-gray-500 text-xs mt-1">The BCO must be a {lockedType}.</div>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Optional — leave empty for prospects"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${codeMatch ? 'border-red-500' : 'border-gray-300'}`}
            />
            {codeMatch && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  This Account Code is already assigned to <span className="font-semibold">{codeMatch.account_name}</span>.
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!blocked && similar.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">Similar accounts already exist. Make sure this is not one of them:</div>
                <ul className="space-y-0.5">
                  {similar.map(m => (
                    <li key={m.id}>
                      {m.account_name}{m.account_code ? ` (${m.account_code})` : ''} · {m.type}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500">
            A Bill To and a Shipper are created automatically with the same name, type and account code.
          </div>

          {saveError && <div className="text-red-600 text-xs">{saveError}</div>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || blocked || checking}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
