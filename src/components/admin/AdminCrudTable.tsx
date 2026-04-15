import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, Copy, X, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date';
  required?: boolean;
  hidden?: boolean;
  isPrimary?: boolean;
  defaultValue?: string | number | boolean;
}

interface AdminCrudTableProps {
  tableName: string;
  displayName: string;
  columns: ColumnDef[];
  primaryKey: string;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

type SortDir = 'asc' | 'desc';
type Row = Record<string, unknown>;

const PAGE_SIZE = 50;

export function AdminCrudTable({ tableName, displayName, columns, primaryKey, onToast }: AdminCrudTableProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const visibleCols = columns.filter(c => !c.hidden);
  const textCols = columns.filter(c => c.type === 'text');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setTableError(null);
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.error(`${displayName} fetch error:`, error);
      if (error.message.includes('does not exist') || error.code === '42P01' || error.message.includes('relation')) {
        setTableError(`Table "${tableName}" was not found in the database. Please verify the table name in Supabase and try again.`);
      } else {
        setTableError(`Failed to load data: ${error.message}. Please check the table name and permissions in Supabase.`);
      }
      setLoading(false);
      return;
    }
    setRows(data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      textCols.some(c => String(r[c.key] ?? '').toLowerCase().includes(q))
    );
  }, [rows, search, textCols]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function buildEmptyForm(): Row {
    const f: Row = {};
    columns.forEach(c => {
      if (c.isPrimary) return;
      if (c.defaultValue !== undefined) {
        f[c.key] = c.defaultValue;
      } else if (c.type === 'number') {
        f[c.key] = '';
      } else if (c.type === 'boolean') {
        f[c.key] = false;
      } else {
        f[c.key] = '';
      }
    });
    return f;
  }

  function openAdd() {
    setEditing(null);
    setForm(buildEmptyForm());
    setErrors({});
    setShowModal(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    const f: Row = {};
    columns.forEach(c => {
      if (c.isPrimary) return;
      f[c.key] = row[c.key] ?? (c.type === 'boolean' ? false : '');
    });
    setForm(f);
    setErrors({});
    setShowModal(true);
  }

  function openClone(row: Row) {
    setEditing(null);
    const f: Row = {};
    columns.forEach(c => {
      if (c.isPrimary) return;
      f[c.key] = row[c.key] ?? (c.type === 'boolean' ? false : '');
    });
    setForm(f);
    setErrors({});
    setShowModal(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    columns.forEach(c => {
      if (c.required && !c.isPrimary) {
        const val = form[c.key];
        if (val === undefined || val === null || val === '') {
          e[c.key] = 'Required';
        }
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const payload: Row = {};
    columns.forEach(c => {
      if (c.isPrimary && !editing) return;
      if (c.isPrimary && editing) {
        payload[c.key] = editing[c.key];
        return;
      }
      const val = form[c.key];
      if (c.type === 'number') {
        payload[c.key] = val === '' || val === undefined ? null : Number(val);
      } else {
        payload[c.key] = val;
      }
    });

    if (editing) {
      const { error } = await supabase
        .from(tableName)
        .update(payload)
        .eq(primaryKey, editing[primaryKey]);
      if (error) {
        onToast?.(`Failed to save ${displayName.toLowerCase()}: ${error.message}`, 'error');
        setSaving(false);
        return;
      }
      setRows(prev => prev.map(r => r[primaryKey] === editing[primaryKey] ? { ...r, ...payload } : r));
      onToast?.(`${displayName} saved successfully`, 'success');
    } else {
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()
        .single();
      if (error) {
        onToast?.(`Failed to save ${displayName.toLowerCase()}: ${error.message}`, 'error');
        setSaving(false);
        return;
      }
      if (data) setRows(prev => [data, ...prev]);
      onToast?.(`${displayName} saved successfully`, 'success');
    }
    setSaving(false);
    setShowModal(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq(primaryKey, deleteTarget[primaryKey]);
    if (error) {
      onToast?.(`Failed to delete ${displayName.toLowerCase()}: ${error.message}`, 'error');
      setDeleteTarget(null);
      return;
    }
    setRows(prev => prev.filter(r => r[primaryKey] !== deleteTarget[primaryKey]));
    onToast?.(`${displayName} deleted successfully`, 'success');
    setDeleteTarget(null);
  }

  function formatCell(col: ColumnDef, value: unknown): string {
    if (value === null || value === undefined) return '';
    if (col.type === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  if (tableError) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <p className="text-sm text-gray-600">{tableError}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${displayName.toLowerCase()}s...`}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
          </div>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New {displayName}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {visibleCols.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    onClick={() => toggleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <span className="text-gray-400 text-[10px]">
                        {sortKey === col.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u21C5'}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider sticky right-0 bg-gray-50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={visibleCols.length + 1} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      <span className="text-sm text-gray-500">Loading {displayName.toLowerCase()} records...</span>
                    </div>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length + 1} className="px-4 py-12 text-center text-sm text-gray-500">
                    {rows.length === 0 && !search
                      ? `No records found. Click "+ New ${displayName}" to add the first record.`
                      : 'No records match your search.'}
                  </td>
                </tr>
              ) : paged.map((row, idx) => (
                <tr key={String(row[primaryKey]) || idx} className={`transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50' : ''} hover:bg-blue-50/50`}>
                  {visibleCols.map(col => {
                    const text = formatCell(col, row[col.key]);
                    return (
                      <td key={col.key} className="px-4 py-3 text-sm text-gray-700 max-w-[200px]">
                        <span className="block truncate" title={text}>{text || <span className="text-gray-300">--</span>}</span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right sticky right-0 bg-white">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => openClone(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Clone"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Showing {page * PAGE_SIZE + 1}\u2013{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">{editing ? `Edit ${displayName}` : `Add ${displayName}`}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {columns.filter(c => !c.isPrimary).map(col => (
                <div key={col.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {col.required && <span className="text-red-500">* </span>}
                    {col.label}
                  </label>
                  {col.type === 'boolean' ? (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, [col.key]: !f[col.key] }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form[col.key] ? 'bg-teal-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form[col.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  ) : col.type === 'date' ? (
                    <input
                      type="date"
                      value={String(form[col.key] ?? '')}
                      onChange={e => setForm(f => ({ ...f, [col.key]: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[col.key] ? 'border-red-500' : 'border-gray-300'}`}
                    />
                  ) : col.type === 'number' ? (
                    <input
                      type="number"
                      step="any"
                      value={form[col.key] === null || form[col.key] === undefined ? '' : String(form[col.key])}
                      onChange={e => setForm(f => ({ ...f, [col.key]: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[col.key] ? 'border-red-500' : 'border-gray-300'}`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(form[col.key] ?? '')}
                      onChange={e => setForm(f => ({ ...f, [col.key]: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[col.key] ? 'border-red-500' : 'border-gray-300'}`}
                    />
                  )}
                  {errors[col.key] && <div className="text-xs text-red-500 mt-0.5">{errors[col.key]}</div>}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 p-6 pt-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this record? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
