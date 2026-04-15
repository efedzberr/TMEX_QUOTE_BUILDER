import { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, X, Search, Check, DollarSign, Globe } from 'lucide-react';
import { QuoteLanes } from './QuoteLanes';
import { TermsConditionsTab } from './TermsConditionsTab';
import { PdfQuoteTab } from './pdf/PdfQuoteTab';
import { QuoteLane, Quote, supabase } from '../lib/supabase';
import { EQUIPMENT_TYPES, CURRENCIES, CurrencyCode } from '../lib/constants';

interface QuoteTabsProps {
  lanes: QuoteLane[];
  quote: Quote;
  locked?: boolean;
  onUpdateLane: (id: string, updates: Partial<QuoteLane>) => Promise<boolean>;
  onAddLane: (newLane: Partial<QuoteLane>) => void;
  onAddSplitBillingGroup?: (lanes: Partial<QuoteLane>[]) => Promise<void>;
  onDeleteLane: (id: string) => void;
  onShowDetails: (lane: QuoteLane) => void;
  onGlobalEquipmentTypeChange?: (equipmentType: string) => void;
  onUpdateQuote: (updates: Partial<Quote>) => void;
  onDeleteLinkedLanes?: (laneId: string, linkedLaneId: string) => void;
  onDeleteMultipleLanes?: (laneIds: string[]) => void;
  onDuplicateLane?: (id: string) => void;
  onUpdateLinkedLanes?: (id: string, updates: Partial<QuoteLane>) => void;
  onToggleLaneCurrency?: (id: string) => void;
  onBenchmarkLane?: (lane: QuoteLane) => void;
  currency?: string;
  onToast?: (message: string, type: 'success' | 'error') => void;
  onViewResponse?: () => void;
}

interface GlobalAccessorial {
  id: string;
  commodity: string;
  name_en: string;
  name_es: string;
  default_rate: number;
  unit_type: string;
  notes: string;
}

interface SelectedAccessorial extends GlobalAccessorial {
  rate: number;
}

const EMPTY_FORM = {
  name_en: '',
  name_es: '',
  commodity: EQUIPMENT_TYPES[0],
  unit_type: 'FLAT',
  default_rate: 0,
  notes: '',
};

function NewAccessorialModal({ onClose, onSaved }: { onClose: () => void; onSaved: (acc: GlobalAccessorial) => void }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dupError, setDupError] = useState('');

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name_en.trim()) e.name_en = 'Required';
    if (!form.commodity) e.commodity = 'Required';
    if (!form.unit_type) e.unit_type = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    setDupError('');

    const { data: existing } = await supabase
      .from('accessorials')
      .select('id')
      .ilike('name_en', form.name_en.trim())
      .eq('commodity', form.commodity)
      .maybeSingle();

    if (existing) {
      setDupError('An accessorial with this name already exists for this equipment type');
      setSaving(false);
      return;
    }

    const payload = {
      name_en: form.name_en.trim(),
      name_es: form.name_es.trim(),
      commodity: form.commodity,
      unit_type: form.unit_type,
      default_rate: Number(form.default_rate),
      notes: form.notes.trim(),
    };

    const { data, error } = await supabase.from('accessorials').insert(payload).select().single();
    setSaving(false);
    if (!error && data) {
      onSaved(data);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">New Accessorial</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Service Type</label>
              <select value={form.unit_type} onChange={e => setForm(f => ({ ...f, unit_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="FLAT">FLAT</option>
                <option value="RPM">RPM</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1"><span className="text-red-500">*</span> Default Rate (USD)</label>
              <input type="number" min="0" step="0.01" value={form.default_rate} onChange={e => setForm(f => ({ ...f, default_rate: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const LANG_LABELS = {
  EN: {
    selectedAccessorials: 'Selected Accessorials',
    availableAccessorials: 'Available Accessorials',
    accessorial: 'Accessorial',
    equipmentType: 'Equipment Type',
    unit: 'Unit',
    rate: 'Rate',
    defaultRate: 'Default Rate',
    remove: 'Remove',
    noSelected: 'No accessorials selected. Add from the Available section below.',
    searchPlaceholder: 'Search by name...',
    selectByEquip: 'Select by Equipment Type:',
    selectAll: 'Select All for this Type',
    clearSelection: 'Clear Selection',
    addSelected: 'Add Selected',
    noMatch: 'No accessorials match your search.',
    allAdded: 'All accessorials have been added.',
    newAccessorial: 'New Accessorial',
  },
  ES: {
    selectedAccessorials: 'Accesorios Seleccionados',
    availableAccessorials: 'Accesorios Disponibles',
    accessorial: 'Accesorio',
    equipmentType: 'Tipo de Equipo',
    unit: 'Unidad',
    rate: 'Tarifa',
    defaultRate: 'Tarifa Base',
    remove: 'Eliminar',
    noSelected: 'No hay accesorios seleccionados. Agregue desde la seccion de Disponibles.',
    searchPlaceholder: 'Buscar por nombre...',
    selectByEquip: 'Seleccionar por tipo de equipo:',
    selectAll: 'Seleccionar todos de este tipo',
    clearSelection: 'Limpiar seleccion',
    addSelected: 'Agregar Seleccionados',
    noMatch: 'No se encontraron accesorios.',
    allAdded: 'Todos los accesorios han sido agregados.',
    newAccessorial: 'Nuevo Accesorio',
  },
} as const;

function convertRate(rateUsd: number, toCurrency: CurrencyCode, exchangeRate: number, cadRate: number): number {
  if (toCurrency === 'USD') return rateUsd;
  if (toCurrency === 'MXN') return rateUsd * (exchangeRate || 1);
  if (toCurrency === 'CAD') return rateUsd * (cadRate || 1);
  return rateUsd;
}

function AccessorialsTab({ quote, locked = false, onUpdateQuote }: { quote: Quote; locked?: boolean; onUpdateQuote: (updates: Partial<Quote>) => void }) {
  const [allAccessorials, setAllAccessorials] = useState<GlobalAccessorial[]>([]);
  const [selected, setSelected] = useState<SelectedAccessorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedOpen, setSelectedOpen] = useState(false);
  const [availableOpen, setAvailableOpen] = useState(true);
  const [availSearch, setAvailSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkEquip, setBulkEquip] = useState('All');
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>((quote.accessorials_tab_currency as CurrencyCode) || 'USD');
  const [activeLang, setActiveLang] = useState<'EN' | 'ES'>((quote.accessorials_tab_language as 'EN' | 'ES') || 'EN');

  const labels = LANG_LABELS[activeLang];

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (quote.accessorials_list && Array.isArray(quote.accessorials_list)) {
      setSelected(quote.accessorials_list);
    }
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase.from('accessorials').select('*').order('commodity').order('name_en');
    if (data) setAllAccessorials(data);
    setLoading(false);
  }

  function cycleCurrency() {
    const idx = CURRENCIES.indexOf(activeCurrency);
    const next = CURRENCIES[(idx + 1) % CURRENCIES.length];
    setActiveCurrency(next);
    onUpdateQuote({ accessorials_tab_currency: next });
  }

  function toggleLang() {
    const next = activeLang === 'EN' ? 'ES' : 'EN';
    setActiveLang(next);
    onUpdateQuote({ accessorials_tab_language: next });
  }

  const exchangeRate = quote.exchange_rate || 1;
  const cadRate = quote.cad_exchange_rate || 1;

  const selectedIds = new Set(selected.map(s => s.id));

  const available = allAccessorials.filter(a => {
    if (selectedIds.has(a.id)) return false;
    const matchSearch = !availSearch || a.name_en.toLowerCase().includes(availSearch.toLowerCase()) || (a.name_es || '').toLowerCase().includes(availSearch.toLowerCase());
    return matchSearch;
  });

  function persistChanges(newSelected: SelectedAccessorial[]) {
    setSelected(newSelected);
    const updates: Partial<Quote> = {
      accessorials_list: newSelected,
      accessorials_amount: newSelected.reduce((sum, a) => sum + (a.rate || 0), 0),
    };
    onUpdateQuote(updates);
  }

  function handleRemove(id: string) {
    const newSelected = selected.filter(s => s.id !== id);
    persistChanges(newSelected);
    if (newSelected.length === 0) setSelectedOpen(false);
  }

  function handleRateChange(id: string, displayRate: number) {
    const rateUsd = activeCurrency === 'USD' ? displayRate
      : activeCurrency === 'MXN' ? displayRate / (exchangeRate || 1)
      : displayRate / (cadRate || 1);
    const newSelected = selected.map(s => s.id === id ? { ...s, rate: rateUsd } : s);
    persistChanges(newSelected);
  }

  function handleAddSelected() {
    const toAdd = available.filter(a => checked.has(a.id)).map(a => ({ ...a, rate: a.default_rate }));
    if (toAdd.length === 0) return;
    const newSelected = [...selected, ...toAdd];
    persistChanges(newSelected);
    setChecked(new Set());
    setSelectedOpen(true);
    setAvailableOpen(false);
  }

  function handleBulkSelect() {
    const matching = available.filter(a => bulkEquip === 'All' || a.commodity === bulkEquip);
    setChecked(new Set(matching.map(a => a.id)));
  }

  function handleClearSelection() {
    setChecked(new Set());
  }

  function toggleCheck(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  }

  function handleNewSaved(acc: GlobalAccessorial) {
    setAllAccessorials(prev => [...prev, acc]);
    setShowNewModal(false);
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-500">Loading accessorials...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <button
            onClick={cycleCurrency}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-full hover:bg-gray-50 transition-colors text-gray-700"
          >
            <DollarSign className="w-3.5 h-3.5" />
            {activeCurrency}
          </button>
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-full hover:bg-gray-50 transition-colors text-gray-700"
          >
            <Globe className="w-3.5 h-3.5" />
            {activeLang}
          </button>
          <button
            onClick={() => !locked && setShowNewModal(true)}
            disabled={locked}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              locked ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Plus className="w-4 h-4" /> {labels.newAccessorial}
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          onClick={() => setSelectedOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{labels.selectedAccessorials}</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">{selected.length}</span>
          </div>
          {selectedOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </button>

        {selectedOpen && (
          <div className="p-4">
            {selected.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">{labels.noSelected}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.accessorial}</th>
                    <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.equipmentType}</th>
                    <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.unit}</th>
                    <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.rate}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selected.map(acc => {
                    const displayRate = convertRate(acc.rate || 0, activeCurrency, exchangeRate, cadRate);
                    return (
                      <tr key={acc.id}>
                        <td className="py-2.5 pr-4">
                          <div className="font-medium text-gray-900">
                            {activeLang === 'ES' && acc.name_es ? acc.name_es : acc.name_en}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600 text-xs">{acc.commodity}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${acc.unit_type === 'FLAT' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            {acc.unit_type}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 text-xs whitespace-nowrap">{activeCurrency} $</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={Number(displayRate.toFixed(2))}
                              onChange={e => handleRateChange(acc.id, parseFloat(e.target.value) || 0)}
                              disabled={locked}
                              className={`w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${locked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            />
                          </div>
                        </td>
                        <td className="py-2.5">
                          <button onClick={() => !locked && handleRemove(acc.id)} disabled={locked} className={`p-1 rounded transition-colors ${locked ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'}`}>
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          onClick={() => setAvailableOpen(o => !o)}
        >
          <span className="text-sm font-semibold text-gray-900">{labels.availableAccessorials}</span>
          {availableOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </button>

        {availableOpen && (
          <div className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={labels.searchPlaceholder}
                    value={availSearch}
                    onChange={e => setAvailSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-52"
                  />
                </div>
                <span className="text-xs font-medium text-gray-600">{labels.selectByEquip}</span>
                <select
                  value={bulkEquip}
                  onChange={e => setBulkEquip(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Dry Van">Dry Van</option>
                  <option value="Flat Bed">Flat Bed</option>
                  <option value="Refer">Refer</option>
                </select>
                <button
                  onClick={handleBulkSelect}
                  disabled={locked}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${locked ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-white bg-blue-600 hover:bg-blue-700'}`}
                >
                  {labels.selectAll}
                </button>
                {checked.size > 0 && (
                  <button onClick={handleClearSelection} className="text-sm text-blue-600 hover:underline">
                    {labels.clearSelection}
                  </button>
                )}
              </div>
              <button
                onClick={handleAddSelected}
                disabled={checked.size === 0 || locked}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${locked ? 'bg-gray-300 text-gray-500' : 'text-white bg-blue-600 hover:bg-blue-700'}`}
              >
                <Check className="w-4 h-4" />
                {labels.addSelected} ({checked.size})
              </button>
            </div>

            {available.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                {availSearch ? labels.noMatch : labels.allAdded}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 w-8" />
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.accessorial}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.equipmentType}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.unit}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.defaultRate}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {available.map(acc => (
                      <tr key={acc.id} className={`transition-colors ${locked ? 'opacity-60' : 'hover:bg-blue-50 cursor-pointer'} ${checked.has(acc.id) ? 'bg-blue-50' : ''}`} onClick={() => !locked && toggleCheck(acc.id)}>
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={checked.has(acc.id)}
                            onChange={() => !locked && toggleCheck(acc.id)}
                            onClick={e => e.stopPropagation()}
                            disabled={locked}
                            className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${locked ? 'cursor-not-allowed' : ''}`}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">
                            {activeLang === 'ES' && acc.name_es ? acc.name_es : acc.name_en}
                          </div>
                          {acc.name_es && activeLang === 'EN' && <div className="text-xs text-gray-500">{acc.name_es}</div>}
                          {activeLang === 'ES' && acc.name_en && <div className="text-xs text-gray-500">{acc.name_en}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{acc.commodity}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${acc.unit_type === 'FLAT' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            {acc.unit_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-900">{activeCurrency} ${convertRate(Number(acc.default_rate) || 0, activeCurrency, exchangeRate, cadRate).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showNewModal && (
        <NewAccessorialModal
          onClose={() => setShowNewModal(false)}
          onSaved={handleNewSaved}
        />
      )}
    </div>
  );
}

export function QuoteTabs({
  lanes,
  quote,
  locked = false,
  onUpdateLane,
  onAddLane,
  onAddSplitBillingGroup,
  onDeleteLane,
  onShowDetails,
  onGlobalEquipmentTypeChange,
  onUpdateQuote,
  onDeleteLinkedLanes,
  onDeleteMultipleLanes,
  onDuplicateLane,
  onUpdateLinkedLanes,
  onToggleLaneCurrency,
  onBenchmarkLane,
  currency,
  onToast,
  onViewResponse,
}: QuoteTabsProps) {
  const [activeTab, setActiveTab] = useState<'lanes' | 'accessorials' | 'terms' | 'pdf'>('lanes');

  const tabs = [
    { id: 'lanes' as const, label: 'Quote Lanes' },
    { id: 'accessorials' as const, label: 'Accessorials' },
    { id: 'terms' as const, label: 'Terms & Conditions' },
    { id: 'pdf' as const, label: 'PDF Quote' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="border-b border-gray-200">
        <div className="flex items-center gap-1 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'lanes' && (
          <QuoteLanes
            lanes={lanes}
            quote={quote}
            currency={currency}
            locked={locked}
            onUpdateLane={onUpdateLane}
            onAddLane={onAddLane}
            onAddSplitBillingGroup={onAddSplitBillingGroup}
            onDeleteLane={onDeleteLane}
            onShowDetails={onShowDetails}
            onGlobalEquipmentTypeChange={onGlobalEquipmentTypeChange}
            onDeleteLinkedLanes={onDeleteLinkedLanes}
            onDeleteMultipleLanes={onDeleteMultipleLanes}
            onDuplicateLane={onDuplicateLane}
            onUpdateLinkedLanes={onUpdateLinkedLanes}
            onToggleLaneCurrency={onToggleLaneCurrency}
            onBenchmarkLane={onBenchmarkLane}
          />
        )}

        {activeTab === 'accessorials' && (
          <AccessorialsTab quote={quote} locked={locked} onUpdateQuote={onUpdateQuote} />
        )}

        {activeTab === 'terms' && (
          <TermsConditionsTab quote={quote} lanes={lanes} locked={locked} onUpdateQuote={onUpdateQuote} />
        )}

        {activeTab === 'pdf' && (
          <PdfQuoteTab quote={quote} lanes={lanes} onToast={onToast} onQuoteUpdate={onUpdateQuote} onViewResponse={onViewResponse} />
        )}
      </div>
    </div>
  );
}
