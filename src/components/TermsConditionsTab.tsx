import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, X, Search, Check, Globe } from 'lucide-react';
import { Quote, QuoteLane, supabase } from '../lib/supabase';
import { EQUIPMENT_TYPES } from '../lib/constants';

interface TermCondition {
  id: string;
  name_en: string;
  name_es: string;
  description_en: string;
  description_es: string;
  country: string;
  equipment_type: string;
  active: boolean;
}

interface TermsConditionsTabProps {
  quote: Quote;
  lanes: QuoteLane[];
  locked?: boolean;
  onUpdateQuote: (updates: Partial<Quote>) => void;
}

const TC_COUNTRIES = ['All', 'US', 'MX'];
const TC_EQUIPMENT_OPTIONS = ['All', ...EQUIPMENT_TYPES];

const LANG_LABELS = {
  EN: {
    selectedTerms: 'Selected Terms & Conditions',
    availableTerms: 'Available Terms & Conditions',
    termName: 'Term Name',
    country: 'Country',
    equipmentType: 'Equipment Type',
    remove: 'Remove',
    noSelected: 'No terms selected. Add from the Available section below.',
    searchPlaceholder: 'Search by name...',
    selectByEquip: 'Select by Equipment Type:',
    selectAll: 'Select All for this Type',
    clearSelection: 'Clear Selection',
    addSelected: 'Add Selected',
    noMatch: 'No terms match your search.',
    allAdded: 'All terms have been added.',
  },
  ES: {
    selectedTerms: 'Terminos y Condiciones Seleccionados',
    availableTerms: 'Terminos y Condiciones Disponibles',
    termName: 'Nombre del Termino',
    country: 'Pais',
    equipmentType: 'Tipo de Equipo',
    remove: 'Eliminar',
    noSelected: 'No hay terminos seleccionados. Agregue desde la seccion de Disponibles.',
    searchPlaceholder: 'Buscar por nombre...',
    selectByEquip: 'Seleccionar por tipo de equipo:',
    selectAll: 'Seleccionar todos de este tipo',
    clearSelection: 'Limpiar seleccion',
    addSelected: 'Agregar Seleccionados',
    noMatch: 'No se encontraron terminos.',
    allAdded: 'Todos los terminos han sido agregados.',
  },
} as const;

export function TermsConditionsTab({ quote, lanes, locked, onUpdateQuote }: TermsConditionsTabProps) {
  const [allTerms, setAllTerms] = useState<TermCondition[]>([]);
  const [selected, setSelected] = useState<TermCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpen, setSelectedOpen] = useState(false);
  const [availableOpen, setAvailableOpen] = useState(true);
  const [availSearch, setAvailSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkEquip, setBulkEquip] = useState('All');
  const [activeLang, setActiveLang] = useState<'EN' | 'ES'>((quote.terms_tab_language as 'EN' | 'ES') || 'EN');

  const labels = LANG_LABELS[activeLang];

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (quote.terms_conditions_list && Array.isArray(quote.terms_conditions_list)) {
      setSelected(quote.terms_conditions_list);
      if (quote.terms_conditions_list.length > 0) setSelectedOpen(true);
    }
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase.from('terms_conditions').select('*').eq('active', true).order('name_en');
    if (data) setAllTerms(data);
    setLoading(false);
  }

  function toggleLang() {
    const next = activeLang === 'EN' ? 'ES' : 'EN';
    setActiveLang(next);
    onUpdateQuote({ terms_tab_language: next });
  }

  const laneCountries = new Set<string>();
  lanes.forEach(lane => {
    const origin = lane.origin_city || '';
    const dest = lane.destination_city || '';
    const originCountry = lane.origin_country_code?.toUpperCase();
    if (originCountry === 'US' || originCountry === 'USA') laneCountries.add('US');
    if (originCountry === 'MX' || originCountry === 'MEX') laneCountries.add('MX');
    if (origin.includes(', US') || origin.includes(', TX') || origin.includes(', CA') || origin.includes(', AZ') || origin.includes(', NM')) laneCountries.add('US');
    if (dest.includes(', US') || dest.includes(', TX') || dest.includes(', CA') || dest.includes(', AZ') || dest.includes(', NM')) laneCountries.add('US');
    if (origin.includes(', MX') || origin.includes(', MEX')) laneCountries.add('MX');
    if (dest.includes(', MX') || dest.includes(', MEX')) laneCountries.add('MX');
  });

  const quoteEquipmentType = quote.type_of_service || '';

  const selectedIds = new Set(selected.map(s => s.id));

  const available = allTerms.filter(t => {
    if (selectedIds.has(t.id)) return false;

    const countryMatch = t.country === 'All' || laneCountries.has(t.country);
    if (!countryMatch) return false;

    const equipMatch = t.equipment_type === 'All' || t.equipment_type === quoteEquipmentType;
    if (!equipMatch) return false;

    const nameToSearch = activeLang === 'ES' && t.name_es ? t.name_es : t.name_en;
    const matchSearch = !availSearch || nameToSearch.toLowerCase().includes(availSearch.toLowerCase()) || t.name_en.toLowerCase().includes(availSearch.toLowerCase()) || (t.name_es || '').toLowerCase().includes(availSearch.toLowerCase());
    if (!matchSearch) return false;

    const matchCountryFilter = countryFilter === 'All' || t.country === countryFilter || t.country === 'All';
    if (!matchCountryFilter) return false;

    const matchEquipFilter = bulkEquip === 'All' || t.equipment_type === bulkEquip || t.equipment_type === 'All';
    if (!matchEquipFilter) return false;

    return true;
  });

  function persistChanges(newSelected: TermCondition[]) {
    setSelected(newSelected);
    onUpdateQuote({ terms_conditions_list: newSelected });
  }

  function handleRemove(id: string) {
    const newSelected = selected.filter(s => s.id !== id);
    persistChanges(newSelected);
    if (newSelected.length === 0) setSelectedOpen(false);
  }

  function handleAddSelected() {
    const toAdd = available.filter(a => checked.has(a.id));
    if (toAdd.length === 0) return;
    const newSelected = [...selected, ...toAdd];
    persistChanges(newSelected);
    setChecked(new Set());
    setSelectedOpen(true);
    setAvailableOpen(false);
  }

  function handleBulkSelect() {
    const matching = available.filter(a => bulkEquip === 'All' || a.equipment_type === bulkEquip || a.equipment_type === 'All');
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

  if (loading) return <div className="py-8 text-center text-sm text-gray-500">Loading terms & conditions...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-full hover:bg-gray-50 transition-colors text-gray-700"
        >
          <Globe className="w-3.5 h-3.5" />
          {activeLang}
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          onClick={() => setSelectedOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{labels.selectedTerms}</span>
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
                    <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.termName}</th>
                    <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.country}</th>
                    <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.equipmentType}</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selected.map(term => {
                    const desc = activeLang === 'ES' && term.description_es ? term.description_es : term.description_en;
                    return (
                    <tr key={term.id}>
                      <td className="py-2.5 pr-4">
                        <div className="font-medium text-gray-900">
                          {activeLang === 'ES' && term.name_es ? term.name_es : term.name_en}
                        </div>
                        {desc && <div className="text-xs text-gray-500 mt-0.5">{desc}</div>}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          term.country === 'US' ? 'bg-blue-50 text-blue-700' :
                          term.country === 'MX' ? 'bg-green-50 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {term.country}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 text-xs">{term.equipment_type}</td>
                      <td className="py-2.5">
                        {!locked && (
                          <button onClick={() => handleRemove(term.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
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
          <span className="text-sm font-semibold text-gray-900">{labels.availableTerms}</span>
          {availableOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </button>

        {availableOpen && (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
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
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TC_COUNTRIES.map(c => <option key={c} value={c}>{c === 'All' ? (activeLang === 'ES' ? 'Todos' : 'All') : c}</option>)}
              </select>
              <span className="text-xs font-medium text-gray-600">{labels.selectByEquip}</span>
              <select
                value={bulkEquip}
                onChange={e => setBulkEquip(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TC_EQUIPMENT_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={handleBulkSelect}
                disabled={locked}
                className={`px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
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
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3"
            >
              <Check className="w-4 h-4" />
              {labels.addSelected} ({checked.size})
            </button>

            {available.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                {availSearch || countryFilter !== 'All' || bulkEquip !== 'All' ? labels.noMatch : labels.allAdded}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 w-8" />
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.termName}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.country}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{labels.equipmentType}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {available.map(term => {
                      const availDesc = activeLang === 'ES' && term.description_es ? term.description_es : term.description_en;
                      return (
                      <tr key={term.id} className={`${locked ? '' : 'hover:bg-blue-50 cursor-pointer'} transition-colors ${checked.has(term.id) ? 'bg-blue-50' : ''}`} onClick={() => !locked && toggleCheck(term.id)}>
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={checked.has(term.id)}
                            onChange={() => !locked && toggleCheck(term.id)}
                            onClick={e => e.stopPropagation()}
                            disabled={locked}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">
                            {activeLang === 'ES' && term.name_es ? term.name_es : term.name_en}
                          </div>
                          {availDesc && <div className="text-xs text-gray-500 mt-0.5">{availDesc}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            term.country === 'US' ? 'bg-blue-50 text-blue-700' :
                            term.country === 'MX' ? 'bg-green-50 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {term.country}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{term.equipment_type}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
