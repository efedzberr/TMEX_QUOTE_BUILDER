import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Copy, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AccountLaneFilters, EMPTY_FILTERS } from './AccountLaneFilters';
import { AccountLaneModal } from './AccountLaneModal';
import type { AccountLaneFilterValues } from './AccountLaneFilters';

type Row = Record<string, unknown>;
type SortDir = 'asc' | 'desc';

const TABLE_NAME = 'Account Lane';
const PRIMARY_KEY = 'ID';
const PAGE_SIZE = 50;

const NUMERIC_DB_COLS = [
  'Item', 'Key', 'Rate', 'Minimum', 'Expiration Year',
  'Weekly Ld', 'Annual Ld', 'X7D DAT',
  'US Miles', 'US Rate Per Mile', 'US Rate', 'US Fuel', 'US Fuel Rate Per Mile',
  'Total US Fixed Costs', 'Total US Variable Costs', 'Total US Portion',
  'MX Miles', 'MX Rate Per Mile', 'MX Rate', 'MX Fuel', 'MX Fuel Rate Per Mile',
  'Total MX Fixed Costs', 'Total MX Variable Costs', 'Total MX Portion',
  'Border Crossing Rate', 'Otros', 'Total',
];

interface TableCol {
  key: string;
  label: string;
  format?: 'currency' | 'date';
}

const TABLE_COLUMNS: TableCol[] = [
  { key: 'ID', label: 'ID' },
  { key: 'Contract', label: 'Contract' },
  { key: 'Shipper', label: 'Shipper' },
  { key: 'Parent Account', label: 'Parent Account' },
  { key: 'Effective Date', label: 'Effective Date', format: 'date' },
  { key: 'Origin City', label: 'Origin City' },
  { key: 'Destination City', label: 'Destination City' },
  { key: 'Border Crossing City', label: 'Border Crossing' },
  { key: 'US Rate', label: 'US Rate', format: 'currency' },
  { key: 'MX Rate', label: 'MX Rate', format: 'currency' },
  { key: 'Total', label: 'Total', format: 'currency' },
];

function fmtCurrency(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  const parts = s.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }
  return s;
}

function fmtCell(col: TableCol, v: unknown): string {
  if (v === null || v === undefined) return '';
  if (col.format === 'currency') return fmtCurrency(v);
  if (col.format === 'date') return fmtDate(v);
  return String(v);
}

async function generateNextId(): Promise<string> {
  const { data } = await supabase
    .from(TABLE_NAME)
    .select('ID')
    .order('ID', { ascending: false })
    .limit(1);
  const maxIdStr = data?.[0]?.['ID'] ?? 'A0000000';
  const maxNum = parseInt(String(maxIdStr).replace(/\D/g, ''), 10) || 0;
  return `A${String(maxNum + 1).padStart(7, '0')}`;
}

const EXCLUDED_INSERT_KEYS = ['ID', 'id', 'created_at', 'updated_at'];

interface AccountLanesTabProps {
  onToast?: (message: string, type: 'success' | 'error') => void;
}

export function AccountLanesTab({ onToast }: AccountLanesTabProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AccountLaneFilterValues>({ ...EMPTY_FILTERS });
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [modalKey, setModalKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [cloneData, setCloneData] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setTableError(null);
    const allRows: Row[] = [];
    const BATCH = 1000;
    let from = 0;
    let done = false;

    while (!done) {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .range(from, from + BATCH - 1)
        .order('ID', { ascending: true });

      if (error) {
        console.error('Account Lane fetch error:', error);
        setTableError(`Failed to load data: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        allRows.push(...data);
        from += data.length;
      }

      if (!data || data.length < BATCH) {
        done = true;
      }
    }

    setRows(allRows);
    setLoading(false);
  }

  const uniqueValues = useMemo(() => {
    const pa = new Set<string>();
    const sh = new Set<string>();
    const tt = new Set<string>();
    rows.forEach(r => {
      if (r['Parent Account']) pa.add(String(r['Parent Account']));
      if (r['Shipper']) sh.add(String(r['Shipper']));
      if (r['Tariff Type']) tt.add(String(r['Tariff Type']));
    });
    return {
      parentAccounts: [...pa].sort(),
      shippers: [...sh].sort(),
      tariffTypes: [...tt].sort(),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(r =>
        Object.values(r).some(v => v !== null && String(v).toLowerCase().includes(q))
      );
    }
    if (filters.contract) {
      const q = filters.contract.toLowerCase();
      result = result.filter(r => String(r['Contract'] ?? '').toLowerCase().includes(q));
    }
    if (filters.parentAccount) {
      result = result.filter(r => r['Parent Account'] === filters.parentAccount);
    }
    if (filters.shipper) {
      result = result.filter(r => r['Shipper'] === filters.shipper);
    }
    if (filters.originCity) {
      const q = filters.originCity.toLowerCase();
      result = result.filter(r => String(r['Origin City'] ?? '').toLowerCase().includes(q));
    }
    if (filters.destinationCity) {
      const q = filters.destinationCity.toLowerCase();
      result = result.filter(r => String(r['Destination City'] ?? '').toLowerCase().includes(q));
    }
    if (filters.tariffType) {
      result = result.filter(r => r['Tariff Type'] === filters.tariffType);
    }
    if (filters.dateFrom) {
      result = result.filter(r => {
        const d = String(r['Effective Date'] ?? '');
        return d >= filters.dateFrom;
      });
    }
    if (filters.dateTo) {
      result = result.filter(r => {
        const d = String(r['Effective Date'] ?? '');
        return d <= filters.dateTo;
      });
    }

    return result;
  }, [rows, filters]);

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

  function handleFiltersChange(f: AccountLaneFilterValues) {
    setFilters(f);
    setPage(0);
  }

  function openAdd() {
    setEditing(null);
    setCloneData(null);
    setModalKey(k => k + 1);
    setShowModal(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setCloneData(null);
    setModalKey(k => k + 1);
    setShowModal(true);
  }

  function openClone(row: Row) {
    const clone: Row = {};
    Object.entries(row).forEach(([key, val]) => {
      if (key === PRIMARY_KEY) return;
      clone[key] = val;
    });
    if (clone['Contract']) {
      clone['Contract'] = `${clone['Contract']}-COPY`;
    }
    setEditing(null);
    setCloneData(clone);
    setModalKey(k => k + 1);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setCloneData(null);
  }

  function buildPayload(formData: Row): Row {
    const payload: Row = {};
    Object.entries(formData).forEach(([key, val]) => {
      if (EXCLUDED_INSERT_KEYS.includes(key)) return;
      const strVal = String(val ?? '').replace(/,/g, '');
      if (NUMERIC_DB_COLS.includes(key)) {
        payload[key] = strVal === '' ? null : parseFloat(strVal) || null;
      } else {
        payload[key] = strVal === '' ? null : strVal;
      }
    });
    return payload;
  }

  const handleSave = useCallback(async (formData: Row) => {
    const payload = buildPayload(formData);

    if (editing) {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq(PRIMARY_KEY, editing[PRIMARY_KEY])
        .select();

      if (error) {
        onToast?.(`Failed to update: ${error.message} (Code: ${error.code})`, 'error');
        throw error;
      }

      await load();
      onToast?.('Account Lane updated successfully', 'success');
    } else {
      const newId = await generateNextId();
      const insertPayload = { ...payload, [PRIMARY_KEY]: newId };

      const { error } = await supabase
        .from(TABLE_NAME)
        .insert([insertPayload])
        .select();

      if (error) {
        onToast?.(`Failed to save: ${error.message} (Code: ${error.code})`, 'error');
        throw error;
      }

      await load();
      setSortKey('ID');
      setSortDir('desc');
      setPage(0);
      onToast?.('Account Lane saved successfully', 'success');
    }

    closeModal();
  }, [editing, onToast]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq(PRIMARY_KEY, deleteTarget[PRIMARY_KEY]);
    if (error) {
      console.error('Supabase error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      onToast?.(`Failed to delete: ${error.message}`, 'error');
      setDeleteTarget(null);
      return;
    }
    setRows(prev => prev.filter(r => r[PRIMARY_KEY] !== deleteTarget[PRIMARY_KEY]));
    onToast?.('Account Lane deleted successfully', 'success');
    setDeleteTarget(null);
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
      <AccountLaneFilters
        filters={filters}
        onChange={handleFiltersChange}
        parentAccounts={uniqueValues.parentAccounts}
        shippers={uniqueValues.shippers}
        tariffTypes={uniqueValues.tariffTypes}
        filteredCount={filtered.length}
        totalCount={rows.length}
      />

      <div className="flex items-center justify-end mb-3">
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Account Lane
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {TABLE_COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap"
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
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider sticky right-0 bg-gray-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length + 1} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      <span className="text-sm text-gray-500">Loading account lane records...</span>
                    </div>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length + 1} className="px-4 py-12 text-center text-sm text-gray-500">
                    {rows.length === 0
                      ? 'No records found. Click "+ New Account Lane" to add the first record.'
                      : 'No records match your filters.'}
                  </td>
                </tr>
              ) : paged.map((row, idx) => (
                <tr
                  key={String(row[PRIMARY_KEY]) || idx}
                  className={`transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50' : ''} hover:bg-blue-50/50`}
                >
                  {TABLE_COLUMNS.map(col => {
                    const text = fmtCell(col, row[col.key]);
                    return (
                      <td key={col.key} className="px-4 py-3 text-sm text-gray-700 max-w-[200px] whitespace-nowrap">
                        <span className="block truncate" title={text}>
                          {text || <span className="text-gray-300">--</span>}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right sticky right-0 bg-white">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => openClone(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Clone">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
            Showing {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
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
        <AccountLaneModal
          key={modalKey}
          editing={editing}
          initialData={cloneData}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete this record? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
