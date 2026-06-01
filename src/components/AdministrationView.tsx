import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, Search, X, Check, Copy, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EQUIPMENT_TYPES } from '../lib/constants';
import { AccountLanesTab } from './admin/AccountLanesTab';
import { CostStructureTab } from './admin/CostStructureTab';
import { MarketInformationTab } from './admin/MarketInformationTab';

interface AdministrationViewProps {
  onBack: () => void;
}

type AdminTab = 'accounts' | 'bill_to' | 'shippers' | 'cities' | 'global_variables' | 'border_crossings' | 'accessorials' | 'terms_conditions' | 'account_lanes' | 'cost_structure' | 'market_information';

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

interface BillTo {
  id: string;
  bill_to_name: string;
  account_code: string;
  type: string;
  status: string;
}

interface Shipper {
  id: string;
  shipper_name: string;
  account_code: string;
  type: string;
  status: string;
}

interface City {
  id: string;
  city_name: string;
  state_code: string;
  country_code: string;
  market_name: string;
  city_full_name: string;
  is_border_crossing_city: boolean;
}

interface GlobalVariables {
  id: string;
  fuel_rate_usd: number;
  rate_per_mile: number;
  mxn_exchange_rate: number;
  cad_exchange_rate: number;
  quote_link_expiration_days: number;
}

interface BorderCrossingCity {
  id: string;
  city_name: string;
  country_side: string;
  state: string;
  active: boolean;
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

function SortTh<T>({
  label,
  col,
  sortKey,
  sortDir,
  onToggle,
  className,
}: {
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
          {sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </div>
    </th>
  );
}

function ConfirmDeleteModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Confirm Delete</h3>
        <p className="text-sm text-gray-600 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

const ACCOUNT_TYPES = ['Direct Customer', 'Transportation Company'];
const ACCOUNT_STATUS = ['Active', 'Inactive'];

function ManageAccounts() {
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
        <ConfirmDeleteModal
          message="Are you sure you want to delete this account? This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function ManageBillTo() {
  const [items, setItems] = useState<BillTo[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BillTo | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ bill_to_name: '', account_code: '', type: 'Direct Customer', status: 'Active' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { sorted, sortKey, sortDir, toggle } = useSortable(
    items.filter(i =>
      i.bill_to_name.toLowerCase().includes(search.toLowerCase()) ||
      i.account_code.toLowerCase().includes(search.toLowerCase()) ||
      i.type.toLowerCase().includes(search.toLowerCase()) ||
      i.status.toLowerCase().includes(search.toLowerCase())
    )
  );

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('bill_to').select('*').order('bill_to_name');
    if (data) setItems(data);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ bill_to_name: '', account_code: '', type: 'Direct Customer', status: 'Active' });
    setErrors({});
    setShowModal(true);
  }

  function openEdit(item: BillTo) {
    setEditing(item);
    setForm({ bill_to_name: item.bill_to_name, account_code: item.account_code, type: item.type, status: item.status });
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.bill_to_name.trim()) e.bill_to_name = 'Required';
    if (!form.account_code.trim()) e.account_code = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('bill_to').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) {
        setErrors({ bill_to_name: error.message });
        setSaving(false);
        return;
      }
      setItems(prev => prev.map(i => i.id === editing.id ? { ...i, ...form } : i));
    } else {
      const { data, error } = await supabase.from('bill_to').insert(form).select().single();
      if (error) {
        setErrors({ bill_to_name: error.message });
        setSaving(false);
        return;
      }
      if (data) setItems(prev => [data, ...prev]);
    }
    setSaving(false);
    setShowModal(false);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('bill_to').delete().eq('id', deleteId);
    setItems(prev => prev.filter(i => i.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search bill to..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Bill To
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh<BillTo> label="Bill To Name" col="bill_to_name" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<BillTo> label="Account Code" col="account_code" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<BillTo> label="Type" col="type" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<BillTo> label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No bill to records found</td></tr>
            ) : sorted.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.bill_to_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.account_code}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.type}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Bill To' : 'Add Bill To'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Bill To Name</label>
                <input type="text" value={form.bill_to_name} onChange={e => setForm(f => ({ ...f, bill_to_name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.bill_to_name ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.bill_to_name && <div className="text-xs text-red-500 mt-0.5">{errors.bill_to_name}</div>}
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
        <ConfirmDeleteModal
          message="Are you sure you want to delete this bill to record? This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function ManageShippers() {
  const [items, setItems] = useState<Shipper[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Shipper | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ shipper_name: '', account_code: '', type: 'Direct Customer', status: 'Active' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { sorted, sortKey, sortDir, toggle } = useSortable(
    items.filter(i =>
      i.shipper_name.toLowerCase().includes(search.toLowerCase()) ||
      i.account_code.toLowerCase().includes(search.toLowerCase()) ||
      i.type.toLowerCase().includes(search.toLowerCase()) ||
      i.status.toLowerCase().includes(search.toLowerCase())
    )
  );

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('shippers').select('*').order('shipper_name');
    if (data) setItems(data);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ shipper_name: '', account_code: '', type: 'Direct Customer', status: 'Active' });
    setErrors({});
    setShowModal(true);
  }

  function openEdit(item: Shipper) {
    setEditing(item);
    setForm({ shipper_name: item.shipper_name, account_code: item.account_code, type: item.type, status: item.status });
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.shipper_name.trim()) e.shipper_name = 'Required';
    if (!form.account_code.trim()) e.account_code = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('shippers').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) {
        setErrors({ shipper_name: error.message });
        setSaving(false);
        return;
      }
      setItems(prev => prev.map(i => i.id === editing.id ? { ...i, ...form } : i));
    } else {
      const { data, error } = await supabase.from('shippers').insert(form).select().single();
      if (error) {
        setErrors({ shipper_name: error.message });
        setSaving(false);
        return;
      }
      if (data) setItems(prev => [data, ...prev]);
    }
    setSaving(false);
    setShowModal(false);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('shippers').delete().eq('id', deleteId);
    setItems(prev => prev.filter(i => i.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search shippers..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Shipper
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh<Shipper> label="Shipper Name" col="shipper_name" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<Shipper> label="Account Code" col="account_code" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<Shipper> label="Type" col="type" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<Shipper> label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No shippers found</td></tr>
            ) : sorted.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.shipper_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.account_code}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.type}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Shipper' : 'Add Shipper'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Shipper Name</label>
                <input type="text" value={form.shipper_name} onChange={e => setForm(f => ({ ...f, shipper_name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.shipper_name ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.shipper_name && <div className="text-xs text-red-500 mt-0.5">{errors.shipper_name}</div>}
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
        <ConfirmDeleteModal
          message="Are you sure you want to delete this shipper? This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

const CITIES_PAGE_SIZE = 50;

interface CityFilters {
  cityName: string;
  state: string;
  country: string;
  market: string;
  borderCrossing: 'all' | 'yes' | 'no';
}

const EMPTY_CITY_FILTERS: CityFilters = { cityName: '', state: '', country: '', market: '', borderCrossing: 'all' };

function ManageCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<CityFilters>(EMPTY_CITY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<CityFilters>(EMPTY_CITY_FILTERS);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<City | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ city_name: '', state_code: '', country_code: '', market_name: '', is_border_crossing_city: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { sorted, sortKey, sortDir, toggle } = useSortable(cities);

  const totalPages = Math.ceil(totalCount / CITIES_PAGE_SIZE);

  const hasActiveFilters = appliedFilters.cityName || appliedFilters.state || appliedFilters.country || appliedFilters.market || appliedFilters.borderCrossing !== 'all';

  function handleFilterChange(field: keyof CityFilters, value: string) {
    const updated = { ...filters, [field]: value };
    setFilters(updated);
    if (filterTimer.current) clearTimeout(filterTimer.current);
    filterTimer.current = setTimeout(() => {
      setAppliedFilters(updated);
      setPage(0);
    }, 300);
  }

  function clearFilters() {
    setFilters(EMPTY_CITY_FILTERS);
    setAppliedFilters(EMPTY_CITY_FILTERS);
    setPage(0);
  }

  useEffect(() => { load(appliedFilters, page); }, [appliedFilters, page]);

  async function load(f: CityFilters, pg: number) {
    setLoading(true);
    const from = pg * CITIES_PAGE_SIZE;
    const to = from + CITIES_PAGE_SIZE - 1;

    let query = supabase
      .from('cities')
      .select('id, city_name, state_code, country_code, market_name, city_full_name, is_border_crossing_city', { count: 'exact' })
      .order('city_name');

    if (f.cityName.trim()) query = query.ilike('city_name', `%${f.cityName.trim()}%`);
    if (f.state.trim()) query = query.ilike('state_code', `%${f.state.trim()}%`);
    if (f.country.trim()) query = query.ilike('country_code', `%${f.country.trim()}%`);
    if (f.market.trim()) query = query.ilike('market_name', `%${f.market.trim()}%`);
    if (f.borderCrossing === 'yes') query = query.eq('is_border_crossing_city', true);
    if (f.borderCrossing === 'no') query = query.eq('is_border_crossing_city', false);

    query = query.range(from, to);

    const { data, count } = await query;
    if (data) setCities(data);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ city_name: '', state_code: '', country_code: '', market_name: '', is_border_crossing_city: false });
    setErrors({});
    setShowModal(true);
  }

  function openEdit(c: City) {
    setEditing(c);
    setForm({ city_name: c.city_name, state_code: c.state_code || '', country_code: c.country_code || '', market_name: c.market_name || '', is_border_crossing_city: c.is_border_crossing_city || false });
    setErrors({});
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.city_name.trim()) e.city_name = 'Required';
    if (!form.state_code.trim()) e.state_code = 'Required';
    if (!form.country_code.trim()) e.country_code = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const cityFullName = `${form.city_name}, ${form.state_code}`;
    if (editing) {
      const { error } = await supabase.from('cities').update({ ...form, city_full_name: cityFullName }).eq('id', editing.id);
      if (!error) setCities(prev => prev.map(c => c.id === editing.id ? { ...c, ...form, city_full_name: cityFullName } : c));
    } else {
      const { data, error } = await supabase.from('cities').insert({
        ...form,
        city_full_name: cityFullName,
        city_code: form.city_name.substring(0, 3).toUpperCase(),
        market_code: form.market_name.substring(0, 3).toUpperCase(),
        is_border_crossing_city: form.is_border_crossing_city,
      }).select().single();
      if (!error && data) setCities(prev => [data, ...prev]);
    }
    setSaving(false);
    setShowModal(false);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('cities').delete().eq('id', deleteId);
    setCities(prev => prev.filter(c => c.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div>
      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter Cities</span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
            >
              <X className="w-3 h-3" /> Clear Filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">City Name</label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Nuevo Laredo"
                value={filters.cityName}
                onChange={e => handleFilterChange('cityName', e.target.value)}
                className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {filters.cityName && (
                <button onClick={() => handleFilterChange('cityName', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">State / Province</label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. TM"
                value={filters.state}
                onChange={e => handleFilterChange('state', e.target.value)}
                className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {filters.state && (
                <button onClick={() => handleFilterChange('state', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Country</label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. MEX"
                value={filters.country}
                onChange={e => handleFilterChange('country', e.target.value)}
                className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {filters.country && (
                <button onClick={() => handleFilterChange('country', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Market</label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. TAMAULIPAS"
                value={filters.market}
                onChange={e => handleFilterChange('market', e.target.value)}
                className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {filters.market && (
                <button onClick={() => handleFilterChange('market', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Border Crossing</label>
            <select
              value={filters.borderCrossing}
              onChange={e => handleFilterChange('borderCrossing', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Cities</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        {!loading && (
          <span className="text-sm text-gray-500">
            {totalCount} {totalCount === 1 ? 'city' : 'cities'} {hasActiveFilters ? 'found' : 'total'}
          </span>
        )}
        {loading && <span className="text-sm text-gray-400">Searching...</span>}
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors ml-auto">
          <Plus className="w-4 h-4" /> Add City
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh<City> label="City Name" col="city_name" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<City> label="State/Province" col="state_code" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<City> label="Country" col="country_code" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<City> label="Market" col="market_name" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Border Crossing City</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                {hasActiveFilters ? 'No cities found matching the selected filters.' : 'No cities found'}
              </td></tr>
            ) : sorted.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.city_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.state_code}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.country_code}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.market_name}</td>
                <td className="px-4 py-3 text-center">
                  {c.is_border_crossing_city ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 rounded-full">
                      <Check className="w-3 h-3 text-green-700" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-100 rounded-full">
                      <X className="w-3 h-3 text-gray-400" />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-500">
            Showing {page * CITIES_PAGE_SIZE + 1}–{Math.min((page + 1) * CITIES_PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageNum = totalPages <= 7 ? i : (page < 4 ? i : (page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i));
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 text-xs font-medium rounded transition-colors ${pageNum === page ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50 text-gray-700'}`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit City' : 'Add City'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> City Name</label>
                <input type="text" value={form.city_name} onChange={e => setForm(f => ({ ...f, city_name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.city_name ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.city_name && <div className="text-xs text-red-500 mt-0.5">{errors.city_name}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> State/Province</label>
                <input type="text" value={form.state_code} onChange={e => setForm(f => ({ ...f, state_code: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.state_code ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.state_code && <div className="text-xs text-red-500 mt-0.5">{errors.state_code}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Country</label>
                <input type="text" value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.country_code ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.country_code && <div className="text-xs text-red-500 mt-0.5">{errors.country_code}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Market</label>
                <input type="text" value={form.market_name} onChange={e => setForm(f => ({ ...f, market_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_border_crossing_city: !f.is_border_crossing_city }))}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${form.is_border_crossing_city ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.is_border_crossing_city ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <label className="text-sm font-medium text-gray-700 cursor-pointer select-none" onClick={() => setForm(f => ({ ...f, is_border_crossing_city: !f.is_border_crossing_city }))}>
                  Border Crossing City
                </label>
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
        <ConfirmDeleteModal
          message="Are you sure you want to delete this city? This may affect existing quotes. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function ManageGlobalVariables() {
  const [vars, setVars] = useState<GlobalVariables | null>(null);
  const [form, setForm] = useState({ fuel_rate_usd: 0, rate_per_mile: 0, mxn_exchange_rate: 0, cad_exchange_rate: 0, quote_link_expiration_days: 30 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('global_variables').select('*').limit(1).maybeSingle();
    if (data) {
      setVars(data);
      setForm({
        fuel_rate_usd: data.fuel_rate_usd,
        rate_per_mile: data.rate_per_mile ?? 0,
        mxn_exchange_rate: data.mxn_exchange_rate,
        cad_exchange_rate: data.cad_exchange_rate,
        quote_link_expiration_days: data.quote_link_expiration_days ?? 30,
      });
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const updates = { ...form, updated_at: new Date().toISOString() };
    if (vars) {
      await supabase.from('global_variables').update(updates).eq('id', vars.id);
    } else {
      const { data } = await supabase.from('global_variables').insert(form).select().single();
      if (data) setVars(data);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-500">Loading...</div>;

  return (
    <div className="max-w-lg">
      <p className="text-sm text-gray-600 mb-6">These default values are applied when creating new quotes. Changes take effect immediately for new quotes.</p>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Rate (Rate per Mile)</label>
          <input type="number" step="0.01" value={form.fuel_rate_usd}
            onChange={e => setForm(f => ({ ...f, fuel_rate_usd: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rate Per Mile</label>
          <input type="number" step="0.01" value={form.rate_per_mile}
            onChange={e => setForm(f => ({ ...f, rate_per_mile: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">MXN Exchange Rate (1 USD = X MXN)</label>
          <input type="number" step="0.0001" value={form.mxn_exchange_rate}
            onChange={e => setForm(f => ({ ...f, mxn_exchange_rate: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CAD Exchange Rate (1 USD = X CAD)</label>
          <input type="number" step="0.0001" value={form.cad_exchange_rate}
            onChange={e => setForm(f => ({ ...f, cad_exchange_rate: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quote Link Expiration (days)</label>
          <p className="text-xs text-gray-500 mb-1.5">Default number of days before a customer portal link expires.</p>
          <input type="number" min={1} max={90} step="1" value={form.quote_link_expiration_days}
            onChange={e => setForm(f => ({ ...f, quote_link_expiration_days: Math.max(1, Math.min(90, parseInt(e.target.value) || 30)) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
            <Check className="w-4 h-4" /> Saved successfully
          </span>
        )}
      </div>
    </div>
  );
}

function ManageBorderCrossings() {
  const [cities, setCities] = useState<City[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const { sorted, sortKey, sortDir, toggle } = useSortable(
    cities.filter(c =>
      c.city_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.state_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.country_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.market_name || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('cities')
      .select('id, city_name, state_code, country_code, market_name, city_full_name, is_border_crossing_city')
      .eq('is_border_crossing_city', true)
      .order('city_name');
    if (data) setCities(data);
    setLoading(false);
  }

  return (
    <div>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          This is a filtered view of cities marked as Border Crossing Cities. To add or edit border crossing cities, go to the <strong>Cities</strong> tab and enable the "Border Crossing City" toggle on any city.
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search border crossing cities..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64" />
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh<City> label="City Name" col="city_name" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<City> label="State/Province" col="state_code" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<City> label="Country" col="country_code" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              <SortTh<City> label="Market" col="market_name" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No border crossing cities found. Mark cities in the Cities tab to see them here.</td></tr>
            ) : sorted.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.city_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.state_code}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.country_code}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.market_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AccessorialRecord {
  id: string;
  commodity: string;
  name_en: string;
  name_es: string;
  default_rate: number;
  unit_type: string;
  notes: string;
  country: string;
}

const ACCESSORIAL_COUNTRIES = ['US', 'MX', 'CA', 'Both'];
const EMPTY_ACC_FORM = { name_en: '', name_es: '', commodity: EQUIPMENT_TYPES[0], unit_type: 'FLAT', default_rate: 0, notes: '', country: 'Both' };

function ManageAccessorials() {
  const [items, setItems] = useState<AccessorialRecord[]>([]);
  const [search, setSearch] = useState('');
  const [equipFilter, setEquipFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AccessorialRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_ACC_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dupError, setDupError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('accessorials').select('*').order('commodity').order('name_en');
    if (data) setItems(data);
    setLoading(false);
  }

  const filtered = items.filter(i => {
    const matchSearch = i.name_en.toLowerCase().includes(search.toLowerCase()) || i.name_es.toLowerCase().includes(search.toLowerCase());
    const matchEquip = equipFilter === 'All' || i.commodity === equipFilter;
    return matchSearch && matchEquip;
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_ACC_FORM });
    setErrors({});
    setDupError('');
    setShowModal(true);
  }

  function openEdit(item: AccessorialRecord) {
    setEditing(item);
    setForm({ name_en: item.name_en, name_es: item.name_es || '', commodity: item.commodity || EQUIPMENT_TYPES[0], unit_type: item.unit_type || 'FLAT', default_rate: item.default_rate || 0, notes: item.notes || '', country: item.country || 'Both' });
    setErrors({});
    setDupError('');
    setShowModal(true);
  }

  function openClone(item: AccessorialRecord) {
    setEditing(null);
    setForm({ name_en: `Copy of ${item.name_en}`, name_es: item.name_es || '', commodity: item.commodity || EQUIPMENT_TYPES[0], unit_type: item.unit_type || 'FLAT', default_rate: item.default_rate || 0, notes: item.notes || '', country: item.country || 'Both' });
    setErrors({});
    setDupError('');
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name_en.trim()) e.name_en = 'Required';
    if (!form.commodity) e.commodity = 'Required';
    if (!form.unit_type) e.unit_type = 'Required';
    if (form.default_rate === null || form.default_rate === undefined || isNaN(Number(form.default_rate))) e.default_rate = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    setDupError('');

    const isDup = items.some(i =>
      i.name_en.trim().toLowerCase() === form.name_en.trim().toLowerCase() &&
      i.commodity === form.commodity &&
      (!editing || i.id !== editing.id)
    );

    if (isDup) {
      setDupError('An accessorial with this name already exists for this equipment type');
      setSaving(false);
      return;
    }

    const payload = { name_en: form.name_en.trim(), name_es: form.name_es.trim(), commodity: form.commodity, unit_type: form.unit_type, default_rate: Number(form.default_rate), notes: form.notes.trim(), country: form.country };

    if (editing) {
      const { error } = await supabase.from('accessorials').update(payload).eq('id', editing.id);
      if (!error) setItems(prev => prev.map(i => i.id === editing.id ? { ...i, ...payload } : i));
    } else {
      const { data, error } = await supabase.from('accessorials').insert(payload).select().single();
      if (!error && data) setItems(prev => [...prev, data]);
    }
    setSaving(false);
    setShowModal(false);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('accessorials').delete().eq('id', deleteId);
    setItems(prev => prev.filter(i => i.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-56" />
          </div>
          <div className="relative">
            <select value={equipFilter} onChange={e => setEquipFilter(e.target.value)}
              className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none">
              <option value="All">All Equipment Types</option>
              {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> New Accessorial
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name (English)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name (Spanish)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Equipment Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Country</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Service Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Default Rate (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Notes</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No accessorials found</td></tr>

            ) : filtered.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name_en}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.name_es}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.commodity}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    item.country === 'US' ? 'bg-blue-50 text-blue-700' :
                    item.country === 'MX' ? 'bg-green-50 text-green-700' :
                    item.country === 'CA' ? 'bg-red-50 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {item.country || 'Both'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.unit_type === 'FLAT' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                    {item.unit_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">${Number(item.default_rate).toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px] truncate">{item.notes}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(item)} title="Edit" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => openClone(item)} title="Clone" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(item.id)} title="Delete" className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Accessorial' : 'New Accessorial'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            {dupError && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{dupError}</div>}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Name (English)</label>
                  <input type="text" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.name_en ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.name_en && <div className="text-xs text-red-500 mt-0.5">{errors.name_en}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (Spanish)</label>
                  <input type="text" value={form.name_es} onChange={e => setForm(f => ({ ...f, name_es: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Equipment Type</label>
                  <select value={form.commodity} onChange={e => setForm(f => ({ ...f, commodity: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.commodity ? 'border-red-500' : 'border-gray-300'}`}>
                    {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.commodity && <div className="text-xs text-red-500 mt-0.5">{errors.commodity}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Service Type</label>
                  <select value={form.unit_type} onChange={e => setForm(f => ({ ...f, unit_type: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.unit_type ? 'border-red-500' : 'border-gray-300'}`}>
                    <option value="FLAT">FLAT</option>
                    <option value="RPM">RPM</option>
                  </select>
                  {errors.unit_type && <div className="text-xs text-red-500 mt-0.5">{errors.unit_type}</div>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Default Rate (USD)</label>
                  <input type="number" min="0" step="0.01" value={form.default_rate} onChange={e => setForm(f => ({ ...f, default_rate: parseFloat(e.target.value) || 0 }))}
                    className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.default_rate ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.default_rate && <div className="text-xs text-red-500 mt-0.5">{errors.default_rate}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    {ACCESSORIAL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
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
        <ConfirmDeleteModal
          message="Are you sure you want to delete this accessorial? This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

const TC_COUNTRIES = ['US', 'MX', 'All'];
const TC_EQUIPMENT_TYPES = ['All', ...EQUIPMENT_TYPES];
const TC_TYPES = ['Note', 'T&C', 'Disclaimer'];
const EMPTY_TC_FORM = { name_en: '', name_es: '', description_en: '', description_es: '', country: 'All', equipment_type: 'All', active: true, Type: 'T&C' };

interface TermConditionRecord {
  id: string;
  name_en: string;
  name_es: string;
  description_en: string;
  description_es: string;
  country: string;
  equipment_type: string;
  active: boolean;
  Type?: string;
}

function ManageTermsConditions() {
  const [items, setItems] = useState<TermConditionRecord[]>([]);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [equipFilter, setEquipFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TermConditionRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_TC_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dupError, setDupError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('terms_conditions').select('*').order('name_en');
    if (data) setItems(data);
    setLoading(false);
  }

  const filtered = items.filter(i => {
    const matchSearch = i.name_en.toLowerCase().includes(search.toLowerCase()) || (i.name_es || '').toLowerCase().includes(search.toLowerCase());
    const matchCountry = countryFilter === 'All' || i.country === countryFilter;
    const matchEquip = equipFilter === 'All' || i.equipment_type === equipFilter || i.equipment_type === 'All';
    const itemType = i.Type || 'T&C';
    const matchType = typeFilter === 'All' || itemType === typeFilter;
    return matchSearch && matchCountry && matchEquip && matchType;
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_TC_FORM });
    setErrors({});
    setDupError('');
    setShowModal(true);
  }

  function openEdit(item: TermConditionRecord) {
    setEditing(item);
    setForm({
      name_en: item.name_en,
      name_es: item.name_es || '',
      description_en: item.description_en || '',
      description_es: item.description_es || '',
      country: item.country || 'All',
      equipment_type: item.equipment_type || 'All',
      active: item.active !== false,
      Type: item.Type || 'T&C',
    });
    setErrors({});
    setDupError('');
    setShowModal(true);
  }

  function openClone(item: TermConditionRecord) {
    setEditing(null);
    setForm({
      name_en: `Copy of ${item.name_en}`,
      name_es: item.name_es || '',
      description_en: item.description_en || '',
      description_es: item.description_es || '',
      country: item.country || 'All',
      equipment_type: item.equipment_type || 'All',
      active: item.active !== false,
      Type: item.Type || 'T&C',
    });
    setErrors({});
    setDupError('');
    setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name_en.trim()) e.name_en = 'Required';
    if (!form.country) e.country = 'Required';
    if (!form.equipment_type) e.equipment_type = 'Required';
    if (!form.Type) e.Type = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    setDupError('');

    const isDup = items.some(i =>
      i.name_en.trim().toLowerCase() === form.name_en.trim().toLowerCase() &&
      i.country === form.country &&
      i.equipment_type === form.equipment_type &&
      (!editing || i.id !== editing.id)
    );

    if (isDup) {
      setDupError('A term with this name already exists for this Country and Equipment Type');
      setSaving(false);
      return;
    }

    const payload = {
      name_en: form.name_en.trim(),
      name_es: form.name_es.trim(),
      description_en: form.description_en.trim(),
      description_es: form.description_es.trim(),
      country: form.country,
      equipment_type: form.equipment_type,
      active: form.active,
      Type: form.Type,
    };

    if (editing) {
      const { error } = await supabase.from('terms_conditions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (!error) setItems(prev => prev.map(i => i.id === editing.id ? { ...i, ...payload } : i));
    } else {
      const { data, error } = await supabase.from('terms_conditions').insert(payload).select().single();
      if (!error && data) setItems(prev => [...prev, data]);
    }
    setSaving(false);
    setShowModal(false);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('terms_conditions').delete().eq('id', deleteId);
    setItems(prev => prev.filter(i => i.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-56" />
          </div>
          <div className="relative">
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
              className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none">
              <option value="All">All Countries</option>
              {TC_COUNTRIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={equipFilter} onChange={e => setEquipFilter(e.target.value)}
              className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none">
              <option value="All">All Equipment Types</option>
              {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none">
              <option value="All">All Types</option>
              {TC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> New Term
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Term Name (English)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Term Name (Spanish)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description (EN)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Country</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Equipment Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Active</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No terms found</td></tr>
            ) : filtered.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name_en}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.name_es}</td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{item.description_en}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    item.country === 'US' ? 'bg-blue-50 text-blue-700' :
                    item.country === 'MX' ? 'bg-green-50 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {item.country}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.equipment_type}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {item.active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    (item.Type || 'T&C') === 'T&C' ? 'bg-blue-50 text-blue-700' :
                    (item.Type || 'T&C') === 'Note' ? 'bg-amber-50 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {item.Type || 'T&C'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(item)} title="Edit" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => openClone(item)} title="Clone" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(item.id)} title="Delete" className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Term' : 'New Term'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            {dupError && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{dupError}</div>}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Term Name (English)</label>
                  <input type="text" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.name_en ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.name_en && <div className="text-xs text-red-500 mt-0.5">{errors.name_en}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Term Name (Spanish)</label>
                  <input type="text" value={form.name_es} onChange={e => setForm(f => ({ ...f, name_es: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Content (English)</label>
                <textarea rows={4} value={form.description_en} onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Content (Spanish)</label>
                <textarea rows={4} value={form.description_es} onChange={e => setForm(f => ({ ...f, description_es: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Country</label>
                  <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.country ? 'border-red-500' : 'border-gray-300'}`}>
                    {TC_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.country && <div className="text-xs text-red-500 mt-0.5">{errors.country}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Equipment Type</label>
                  <select value={form.equipment_type} onChange={e => setForm(f => ({ ...f, equipment_type: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.equipment_type ? 'border-red-500' : 'border-gray-300'}`}>
                    {TC_EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.equipment_type && <div className="text-xs text-red-500 mt-0.5">{errors.equipment_type}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Type</label>
                  <select value={form.Type} onChange={e => setForm(f => ({ ...f, Type: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.Type ? 'border-red-500' : 'border-gray-300'}`}>
                    {TC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.Type && <div className="text-xs text-red-500 mt-0.5">{errors.Type}</div>}
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
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
        <ConfirmDeleteModal
          message="Are you sure you want to delete this term? This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'accounts', label: 'Partner Accounts' },
  { id: 'bill_to', label: 'Bill To' },
  { id: 'shippers', label: 'Shippers' },
  { id: 'cities', label: 'Cities' },
  { id: 'global_variables', label: 'Global Variables' },
  { id: 'border_crossings', label: 'Border Crossing Cities' },
  { id: 'accessorials', label: 'Accessorials' },
  { id: 'terms_conditions', label: 'Terms & Conditions' },
  { id: 'account_lanes', label: 'Account Lanes' },
  { id: 'cost_structure', label: 'Cost Structure' },
  { id: 'market_information', label: 'Market Information' },
];

export function AdministrationView({ onBack }: AdministrationViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('accounts');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  function handleToast(message: string, type: 'success' | 'error') {
    setToastMessage(message);
    setToastType(type);
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/Transmex_Logo_II.jpeg" alt="Transmex Logo" className="h-10 object-contain" />
              <div className="text-sm text-gray-500">Smart Pricing Hub</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Quotes
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 pt-5 pb-0 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900 mb-4">Administration</h1>
            <nav className="flex gap-0 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'accounts' && <ManageAccounts />}
            {activeTab === 'bill_to' && <ManageBillTo />}
            {activeTab === 'shippers' && <ManageShippers />}
            {activeTab === 'cities' && <ManageCities />}
            {activeTab === 'global_variables' && <ManageGlobalVariables />}
            {activeTab === 'border_crossings' && <ManageBorderCrossings />}
            {activeTab === 'accessorials' && <ManageAccessorials />}
            {activeTab === 'terms_conditions' && <ManageTermsConditions />}
            {activeTab === 'account_lanes' && <AccountLanesTab onToast={handleToast} />}
            {activeTab === 'cost_structure' && <CostStructureTab onToast={handleToast} />}
            {activeTab === 'market_information' && <MarketInformationTab onToast={handleToast} />}
          </div>
        </div>
      </main>

      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${toastType === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
