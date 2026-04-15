import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';

type Row = Record<string, unknown>;

interface AccountLaneModalProps {
  editing: Row | null;
  initialData?: Row | null;
  onClose: () => void;
  onSave: (data: Row) => Promise<void>;
}

const CALCULATED_FIELDS = [
  'US Rate', 'US Fuel', 'Total US Fixed Costs', 'Total US Variable Costs', 'Total US Portion',
  'MX Rate', 'MX Fuel', 'Total MX Fixed Costs', 'Total MX Variable Costs', 'Total MX Portion',
  'Total',
];

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function fmtCurrencyDisplay(v: number): string {
  if (!v || isNaN(v)) return '';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNum(v: string): number {
  const cleaned = v.replace(/,/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function AccountLaneModal({ editing, initialData, onClose, onSave }: AccountLaneModalProps) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const source = editing || initialData;
    if (!source) return {};
    const f: Record<string, string> = {};
    Object.entries(source).forEach(([key, val]) => {
      f[key] = val === null || val === undefined ? '' : String(val);
    });
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = useCallback((key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const handleCurrencyBlur = useCallback((key: string) => {
    setForm(f => {
      const raw = f[key];
      if (!raw) return f;
      const n = parseFloat(raw.replace(/,/g, ''));
      if (isNaN(n)) return f;
      const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (formatted === raw) return f;
      return { ...f, [key]: formatted };
    });
  }, []);

  useEffect(() => {
    const usMiles = parseNum(form['US Miles'] || '');
    const usRPM = parseNum(form['US Rate Per Mile'] || '');
    const usFuelRPM = parseNum(form['US Fuel Rate Per Mile'] || '');
    const mxMiles = parseNum(form['MX Miles'] || '');
    const mxRPM = parseNum(form['MX Rate Per Mile'] || '');
    const mxFuelRPM = parseNum(form['MX Fuel Rate Per Mile'] || '');
    const bcRate = parseNum(form['Border Crossing Rate'] || '');
    const otros = parseNum(form['Otros'] || '');

    const usLineHaul = usMiles * usRPM;
    const usTotalFuel = usMiles * usFuelRPM;
    const usTotalFixed = usLineHaul;
    const usTotalVariable = usTotalFuel;
    const usTotalPortion = usTotalFixed + usTotalVariable;

    const mxLineHaul = mxMiles * mxRPM;
    const mxTotalFuel = mxMiles * mxFuelRPM;
    const mxTotalFixed = mxLineHaul;
    const mxTotalVariable = mxTotalFuel;
    const mxTotalPortion = mxTotalFixed + mxTotalVariable;

    const grandTotal = usTotalPortion + mxTotalPortion + bcRate + otros;

    setForm(prev => ({
      ...prev,
      'US Rate': usLineHaul > 0 ? usLineHaul.toFixed(2) : '',
      'US Fuel': usTotalFuel > 0 ? usTotalFuel.toFixed(2) : '',
      'Total US Fixed Costs': usTotalFixed > 0 ? usTotalFixed.toFixed(2) : '',
      'Total US Variable Costs': usTotalVariable > 0 ? usTotalVariable.toFixed(2) : '',
      'Total US Portion': usTotalPortion > 0 ? usTotalPortion.toFixed(2) : '',
      'MX Rate': mxLineHaul > 0 ? mxLineHaul.toFixed(2) : '',
      'MX Fuel': mxTotalFuel > 0 ? mxTotalFuel.toFixed(2) : '',
      'Total MX Fixed Costs': mxTotalFixed > 0 ? mxTotalFixed.toFixed(2) : '',
      'Total MX Variable Costs': mxTotalVariable > 0 ? mxTotalVariable.toFixed(2) : '',
      'Total MX Portion': mxTotalPortion > 0 ? mxTotalPortion.toFixed(2) : '',
      'Total': grandTotal > 0 ? grandTotal.toFixed(2) : '',
    }));
  }, [
    form['US Miles'],
    form['US Rate Per Mile'],
    form['US Fuel Rate Per Mile'],
    form['MX Miles'],
    form['MX Rate Per Mile'],
    form['MX Fuel Rate Per Mile'],
    form['Border Crossing Rate'],
    form['Otros'],
  ]);

  async function handleSave() {
    if (!form['Contract']?.trim()) {
      setError('Contract is required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
    } catch {
      setError('Failed to save. Check console for details.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
  const readOnlyCls =
    'w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100 text-gray-500 cursor-not-allowed outline-none';
  const currReadOnlyCls =
    'flex-1 px-3 py-2 border border-gray-300 rounded-r text-sm bg-gray-100 text-gray-500 cursor-not-allowed outline-none';
  const currInputCls =
    'flex-1 px-3 py-2 border border-gray-300 rounded-r text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

  const isCalc = (field: string) => CALCULATED_FIELDS.includes(field);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[860px] mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {editing ? 'Edit Account Lane' : 'Add Account Lane'}
            </h3>
            {editing && (
              <p className="text-xs text-gray-500 mt-0.5">ID: {toStr(editing['ID'])}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 rounded-t bg-[#1E40AF]">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">General Information</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contract *</label>
                <input type="text" value={toStr(form['Contract'])} onChange={e => set('Contract', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">C Code</label>
                <input type="text" value={toStr(form['C Code'])} onChange={e => set('C Code', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Parent Account</label>
                <input type="text" value={toStr(form['Parent Account'])} onChange={e => set('Parent Account', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tariff Type</label>
                <input type="text" value={toStr(form['Tariff Type'])} onChange={e => set('Tariff Type', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Shipper</label>
                <input type="text" value={toStr(form['Shipper'])} onChange={e => set('Shipper', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Item</label>
                <input type="text" value={toStr(form['Item'])} onChange={e => set('Item', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date</label>
                <input type="date" value={toStr(form['Effective Date'])} onChange={e => set('Effective Date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">VOL -- LPM</label>
                <input type="text" value={toStr(form['VOL LPM'])} onChange={e => set('VOL LPM', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Revision</label>
                <input type="text" value={toStr(form['Revision'])} onChange={e => set('Revision', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Transit Time</label>
                <input type="text" value={toStr(form['Transit Time'])} onChange={e => set('Transit Time', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Key</label>
                <input type="text" value={toStr(form['Key'])} onChange={e => set('Key', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rate Type</label>
                <input type="text" value={toStr(form['Rate type'])} onChange={e => set('Rate type', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                <input type="text" value={toStr(form['Currency'])} onChange={e => set('Currency', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tariff Description</label>
                <input type="text" value={toStr(form['Tariff Description'])} onChange={e => set('Tariff Description', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective From Date</label>
                <input type="date" value={toStr(form['Effective From Date'])} onChange={e => set('Effective From Date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective To Date</label>
                <input type="date" value={toStr(form['Effective To Date'])} onChange={e => set('Effective To Date', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Expiration Year</label>
                <input type="number" step="1" value={toStr(form['Expiration Year'])} onChange={e => set('Expiration Year', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SCAC</label>
                <input type="text" value={toStr(form['SCAC'])} onChange={e => set('SCAC', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Comments</label>
                <textarea value={toStr(form['Comments'])} onChange={e => set('Comments', e.target.value)} rows={2} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <textarea value={toStr(form['Remarks'])} onChange={e => set('Remarks', e.target.value)} rows={2} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 rounded-t bg-[#374151]">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Lane Routing</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Origin City</label>
                <input type="text" value={toStr(form['Origin City'])} onChange={e => set('Origin City', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Destination City</label>
                <input type="text" value={toStr(form['Destination City'])} onChange={e => set('Destination City', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Border Crossing Point</label>
                <input type="text" value={toStr(form['Border Crossing Point'])} onChange={e => set('Border Crossing Point', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Border Crossing City</label>
                <input type="text" value={toStr(form['Border Crossing City'])} onChange={e => set('Border Crossing City', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stop 1</label>
                <input type="text" value={toStr(form['Stop 1'])} onChange={e => set('Stop 1', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stop Off</label>
                <input type="text" value={toStr(form['Stop Off'])} onChange={e => set('Stop Off', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 rounded-t bg-[#1D4ED8]">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">US Portion</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">US Miles</label>
                <input type="number" step="any" value={toStr(form['US Miles'])} onChange={e => set('US Miles', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">US Fuel Rate Per Mile</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={toStr(form['US Fuel Rate Per Mile'])} onChange={e => set('US Fuel Rate Per Mile', e.target.value)} onBlur={() => handleCurrencyBlur('US Fuel Rate Per Mile')} className={currInputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">US Rate Per Mile</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={toStr(form['US Rate Per Mile'])} onChange={e => set('US Rate Per Mile', e.target.value)} onBlur={() => handleCurrencyBlur('US Rate Per Mile')} className={currInputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total US Fixed Costs</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['Total US Fixed Costs'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">US Rate (Line Haul)</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['US Rate'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total US Variable Costs</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['Total US Variable Costs'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">US Fuel (Total)</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['US Fuel'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total US Portion</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['Total US Portion'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 rounded-t bg-[#166534]">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">MX Portion</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">MX Miles (Kms)</label>
                <input type="number" step="any" value={toStr(form['MX Miles'])} onChange={e => set('MX Miles', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">MX Fuel Rate Per Mile</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={toStr(form['MX Fuel Rate Per Mile'])} onChange={e => set('MX Fuel Rate Per Mile', e.target.value)} onBlur={() => handleCurrencyBlur('MX Fuel Rate Per Mile')} className={currInputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">MX Rate Per Mile</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={toStr(form['MX Rate Per Mile'])} onChange={e => set('MX Rate Per Mile', e.target.value)} onBlur={() => handleCurrencyBlur('MX Rate Per Mile')} className={currInputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total MX Fixed Costs</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['Total MX Fixed Costs'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">MX Rate (Line Haul)</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['MX Rate'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total MX Variable Costs</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['Total MX Variable Costs'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">MX Fuel (Total)</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['MX Fuel'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total MX Portion</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['Total MX Portion'] || ''))} readOnly className={currReadOnlyCls} />
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 rounded-t bg-[#92400E]">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Totals</h4>
            </div>
            <div className="p-4 grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Border Crossing Rate</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={toStr(form['Border Crossing Rate'])} onChange={e => set('Border Crossing Rate', e.target.value)} onBlur={() => handleCurrencyBlur('Border Crossing Rate')} className={currInputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Others (OTROS)</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={toStr(form['Otros'])} onChange={e => set('Otros', e.target.value)} onBlur={() => handleCurrencyBlur('Otros')} className={currInputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">TEAM</label>
                <input type="text" value={toStr(form['Team'])} onChange={e => set('Team', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                  <input type="text" value={fmtCurrencyDisplay(parseNum(form['Total'] || ''))} readOnly className={`${currReadOnlyCls} font-bold`} />
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 rounded-t bg-gray-500">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Additional Fields</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ['AL Origin City', 'AL Origin City'], ['AL Destination City', 'AL Destination City'],
              ].map(([label, field]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type="text" value={toStr(form[field])} onChange={e => set(field, e.target.value)} className={inputCls} />
                </div>
              ))}
              {['Rate', 'Minimum'].map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{field}</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-2.5 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-xs text-gray-500 font-medium whitespace-nowrap">USD $</span>
                    <input type="text" value={toStr(form[field])} onChange={e => set(field, e.target.value)} onBlur={() => handleCurrencyBlur(field)} className={currInputCls} />
                  </div>
                </div>
              ))}
              {[
                ['Commitment Type', 'Commitment Type'], ['Annual Volume', 'Annual Volume'],
                ['Weekly Volume', 'Weekly Volume'], ['Daily Cap', 'Daily Cap'],
                ['Group ID', 'Group ID'], ['Original or Adjusted', 'Original or Adjusted'],
                ['Start DOW', 'Start DOW'], ['Group Annual Volume', 'Group Annual Volume'],
                ['Group Weekly Volume', 'Group Weekly Volume'], ['Group Daily Cap', 'Group Daily Cap'],
                ['Group ID Description', 'Group ID Description'], ['PRPRF', 'PRPRF'],
                ['EDI Link', 'EDI LINK'], ['Print Only', 'Print Only'],
                ['Line Haul Amount', 'Line Haul Amount'], ['Border Crossing Fee', 'Border Crossing Fee'],
                ['Total Amount', 'Total Amount'], ['Tariff Notes', 'Tariff Notes'],
                ['Line Haul Mile', 'Line Haul Mile'], ['Fuel Mile', 'Fuel Mile'],
              ].map(([label, field]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type="text" value={toStr(form[field])} onChange={e => set(field, e.target.value)} className={inputCls} />
                </div>
              ))}
              {[
                ['Weekly Ld', 'Weekly Ld'], ['Annual Ld', 'Annual Ld'], ['X7D DAT', 'X7D DAT'],
              ].map(([label, field]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type="number" step="1" value={toStr(form[field])} onChange={e => set(field, e.target.value)} className={inputCls} />
                </div>
              ))}
              {[
                ['IDKEY', 'IDKEY'],
                ['MTH 1', 'MTH 1'], ['FSR 1', 'FSR 1'],
                ['MTH 2', 'MTH 2'], ['FSR 2', 'FSR 2'],
                ['MTH 3', 'MTH 3'], ['FSR 3', 'FSR 3'],
                ['MTH 4', 'MTH 4'], ['FSR 4', 'FSR 4'],
                ['MTH 5', 'MTH 5'], ['FSR 5', 'FSR 5'],
                ['MTH 6', 'MTH 6'], ['FSR 6', 'FSR 6'],
              ].map(([label, field]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type="text" value={toStr(form[field])} onChange={e => set(field, e.target.value)} className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
