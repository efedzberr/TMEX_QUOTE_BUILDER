import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Account {
  id: string;
  account_name: string;
  account_code: string;
  type: string;
  status: string;
  customer_email?: string;
  customer_fuel_program?: boolean;
  fuel_program_type?: string;
  fuel_rate_per_mile?: number;
  fuel_program_method?: string;
}

type SortDir = 'asc' | 'desc';

function useSortable<T>(items: T[]) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = sortKey
    ? [...items].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : items;

  const toggle = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return { sorted, sortKey, sortDir, toggle };
}

function SortTh<T>({ label, col, sortKey, sortDir, onToggle, className }: {
  label: string;
  col: keyof T;
  sortKey: keyof T | null;
  sortDir: SortDir;
  onToggle: (k: keyof T) => void;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors ${className || ''}`}
      onClick={() => onToggle(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="text-gray-400 text-[10px]">
          {sortKey === col ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u21C5'}
        </span>
      </div>
    </th>
  );
}

const ACCOUNT_TYPES = ['Direct Customer', 'Transportation Company'];
const ACCOUNT_STATUS = ['Active', 'Inactive'];

export function CustomersTable() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ account_name: '', account_code: '', type: 'Direct Customer', status: 'Active', customer_email: '', customer_fuel_program: false, fuel_program_type: 'FRPM', fuel_rate_per_mile: 0, fuel_program_method: 'per_mile' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { sorted, sortKey, sortDir, toggle } = useSortable(
    accounts.filter(a =>
      a.account_name.toLowerCase().includes(search.toLowerCase()) ||
      a.account_code.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase()) ||
      a.status.toLowerCase().includes(search.toLowerCase())
    )
  );

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('accounts').select('*').order('account_name');
    if (data) setAccounts(data);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ account_name: '', account_code: '', type: 'Direct Customer', status: 'Active', customer_email: '', customer_fuel_program: false, fuel_program_type: 'FRPM', fuel_rate_per_mile: 0, fuel_program_method: 'per_mile' });
    setErrors({});
    setShowModal(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setForm({ account_name: a.account_name, account_code: a.account_code, type: a.type, status: a.status, customer_email: a.customer_email || '', customer_fuel_program: a.customer_fuel_program || false, fuel_program_type: a.fuel_program_type || 'FRPM', fuel_rate_per_mile: a.fuel_rate_per_mile || 0, fuel_program_method: a.fuel_program_method || 'per_mile' });
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.account_name.trim()) e.account_name = 'Required';
    if (!form.account_code.trim()) e.account_code = 'Required';
    if (form.customer_fuel_program && (!form.fuel_rate_per_mile || form.fuel_rate_per_mile <= 0)) {
      e.fuel_rate_per_mile = 'Fuel Rate Per Mile is required when Customer Fuel Program is enabled';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const payload = { ...form, name: form.account_name };
    if (editing) {
      const { error } = await supabase.from('accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) {
        setErrors({ account_name: error.message });
        setSaving(false);
        return;
      }
      setAccounts(prev => prev.map(a => a.id === editing.id ? { ...a, ...payload } : a));
    } else {
      const { data, error } = await supabase.from('accounts').insert(payload).select().single();
      if (error) {
        setErrors({ account_name: error.message });
        setSaving(false);
        return;
      }
      if (data) setAccounts(prev => [data, ...prev]);
    }
    setSaving(false);
    setShowModal(false);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('accounts').delete().eq('id', deleteId);
    setAccounts(prev => prev.filter(a => a.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
          />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh<Account> label="Account Name" col="account_name" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<Account> label="Account Code" col="account_code" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<Account> label="Type" col="type" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<Account> label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<Account> label="Email" col="customer_email" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No accounts found</td></tr>
            ) : sorted.map(a => (
              <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.account_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{a.account_code}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{a.type}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{a.customer_email || '\u2014'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(a)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(a.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Account' : 'Add Account'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Account Name</label>
                <input type="text" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.account_name ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.account_name && <div className="text-xs text-red-500 mt-0.5">{errors.account_name}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Account Code</label>
                <input type="text" value={form.account_code} onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.account_code ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.account_code && <div className="text-xs text-red-500 mt-0.5">{errors.account_code}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  {ACCOUNT_STATUS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
                <input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
                  placeholder="customer@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <label className="text-sm font-medium text-gray-700">Customer Fuel Program</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, customer_fuel_program: !f.customer_fuel_program }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.customer_fuel_program ? 'bg-teal-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.customer_fuel_program ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {form.customer_fuel_program && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Program Type</label>
                    <select value={form.fuel_program_type} onChange={e => setForm(f => ({ ...f, fuel_program_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="FRPM">FRPM</option>
                      <option value="PERCENT">PERCENT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Program Method</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="fuel_program_method"
                          value="per_mile"
                          checked={form.fuel_program_method === 'per_mile'}
                          onChange={() => setForm(f => ({ ...f, fuel_program_method: 'per_mile' }))}
                          className="text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-700">Cost Per Mile</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="fuel_program_method"
                          value="percentage"
                          checked={form.fuel_program_method === 'percentage'}
                          onChange={() => setForm(f => ({ ...f, fuel_program_method: 'percentage' }))}
                          className="text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-700">Percentage of Total Section</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.customer_fuel_program && <span className="text-red-500">* </span>}
                  Fuel Rate Per Mile
                </label>
                {form.fuel_program_type === 'PERCENT' && form.customer_fuel_program ? (
                  <div className="relative">
                    <input type="number" step="0.01" min="0"
                      value={form.fuel_rate_per_mile || ''}
                      onChange={e => setForm(f => ({ ...f, fuel_rate_per_mile: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3 py-2 pr-8 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.fuel_rate_per_mile ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">USD $</span>
                    <input type="number" step="0.01" min="0"
                      value={form.fuel_rate_per_mile || ''}
                      onChange={e => setForm(f => ({ ...f, fuel_rate_per_mile: parseFloat(e.target.value) || 0 }))}
                      disabled={!form.customer_fuel_program}
                      className={`w-full pl-16 pr-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!form.customer_fuel_program ? 'bg-gray-100 text-gray-400' : ''} ${errors.fuel_rate_per_mile ? 'border-red-500' : 'border-gray-300'}`}
                    />
                  </div>
                )}
                {errors.fuel_rate_per_mile && <div className="text-xs text-red-500 mt-0.5">{errors.fuel_rate_per_mile}</div>}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this account? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
