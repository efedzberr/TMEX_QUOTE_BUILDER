import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrencyOrDash, CurrencyCode } from '../lib/constants';

export interface SectionAccessorial {
  id: string;
  name_en: string;
  name_es: string;
  unit_type: string;
  default_rate: number;
  commodity: string;
  country: string;
  rate: number;
  miles: number;
}

interface LaneSectionAccessorialsProps {
  section: 'US' | 'MX';
  disabled: boolean;
  selected: SectionAccessorial[];
  onChange: (items: SectionAccessorial[]) => void;
  currencyCode?: CurrencyCode;
}

interface DBAccessorial {
  id: string;
  name_en: string;
  name_es: string;
  unit_type: string;
  default_rate: number;
  commodity: string;
  country: string;
}

export function LaneSectionAccessorials({ section, disabled, selected, onChange, currencyCode = 'USD' }: LaneSectionAccessorialsProps) {
  const [allAccessorials, setAllAccessorials] = useState<DBAccessorial[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('accessorials')
        .select('id, name_en, name_es, unit_type, default_rate, commodity, country')
        .order('commodity')
        .order('name_en');
      if (data) setAllAccessorials(data);
      setLoading(false);
    })();
  }, []);

  const filtered = allAccessorials
    .filter(a => a.country === section || a.country === 'Both')
    .filter(a =>
      a.name_en.toLowerCase().includes(search.toLowerCase()) ||
      a.name_es.toLowerCase().includes(search.toLowerCase())
    );

  const selectedIds = new Set(selected.map(s => s.id));

  const toggle = (acc: DBAccessorial) => {
    if (disabled) return;
    if (selectedIds.has(acc.id)) {
      onChange(selected.filter(s => s.id !== acc.id));
    } else {
      onChange([...selected, {
        id: acc.id,
        name_en: acc.name_en,
        name_es: acc.name_es,
        unit_type: acc.unit_type,
        default_rate: acc.default_rate,
        commodity: acc.commodity,
        country: acc.country,
        rate: acc.default_rate,
        miles: 0,
      }]);
    }
  };

  const updateRate = (id: string, rate: number) => {
    onChange(selected.map(s => s.id === id ? { ...s, rate } : s));
  };

  const updateMiles = (id: string, miles: number) => {
    onChange(selected.map(s => s.id === id ? { ...s, miles } : s));
  };

  const remove = (id: string) => {
    onChange(selected.filter(s => s.id !== id));
  };

  const total = selected.reduce((sum, a) => {
    if (a.unit_type === 'RPM') return sum + (a.rate * (a.miles || 0));
    return sum + a.rate;
  }, 0);

  if (disabled) {
    return (
      <div className="mt-4 opacity-50 pointer-events-none">
        <h4 className="text-xs font-semibold text-gray-500 mb-2">{section} Accessorials</h4>
        <div className="px-3 py-2 text-sm rounded bg-gray-200 text-gray-500">--</div>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <h4 className="text-xs font-semibold text-gray-700 mb-3">{section} Accessorials</h4>

      {selected.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-600 border-b border-gray-100">
                <th className="pb-2 font-semibold">Accessorial</th>
                <th className="pb-2 font-semibold w-16">Unit</th>
                <th className="pb-2 font-semibold w-24">Rate</th>
                {selected.some(s => s.unit_type === 'RPM') && (
                  <th className="pb-2 font-semibold w-20">Miles</th>
                )}
                <th className="pb-2 font-semibold w-24 text-right">Amount</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {selected.map(acc => {
                const amount = acc.unit_type === 'RPM' ? acc.rate * (acc.miles || 0) : acc.rate;
                return (
                  <tr key={acc.id} className="group">
                    <td className="py-2 pr-2">
                      <div className="font-medium text-gray-900">{acc.name_en}</div>
                      <div className="text-gray-400">{acc.name_es}</div>
                    </td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${acc.unit_type === 'FLAT' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                        {acc.unit_type}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 whitespace-nowrap">{currencyCode} $</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={acc.rate}
                          onChange={e => updateRate(acc.id, parseFloat(e.target.value) || 0)}
                          className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                        />
                      </div>
                    </td>
                    {selected.some(s => s.unit_type === 'RPM') && (
                      <td className="py-2">
                        {acc.unit_type === 'RPM' ? (
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={acc.miles}
                            onChange={e => updateMiles(acc.id, parseFloat(e.target.value) || 0)}
                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                    )}
                    <td className="py-2 text-right font-medium text-gray-900">
                      {formatCurrencyOrDash(amount, currencyCode)}
                    </td>
                    <td className="py-2 text-center">
                      <button onClick={() => remove(acc.id)} className="p-0.5 text-red-500 hover:bg-red-50 rounded transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-gray-200 pt-2 mt-1 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-700">Total {section} Accessorials:</span>
            <span className="text-sm font-semibold text-blue-600">{formatCurrencyOrDash(total, currencyCode)}</span>
          </div>
        </div>
      )}

      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          placeholder={`Search ${section} accessorials...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="max-h-[132px] overflow-y-auto border border-gray-200 rounded">
        {loading ? (
          <div className="p-3 text-center text-xs text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-center text-xs text-gray-500">No accessorials found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(acc => (
              <label key={acc.id} className="flex items-start gap-2 p-2 hover:bg-blue-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(acc.id)}
                  onChange={() => toggle(acc)}
                  className="mt-0.5 w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">{acc.name_en}</div>
                  <div className="text-xs text-gray-500 truncate">{acc.name_es}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${acc.unit_type === 'FLAT' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                      {acc.unit_type}
                    </span>
                    <span className="text-xs text-blue-600 font-medium">{formatCurrencyOrDash(acc.default_rate, currencyCode)}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function calcSectionAccessorialsTotal(items: SectionAccessorial[]): number {
  return items.reduce((sum, a) => {
    if (a.unit_type === 'RPM') return sum + (a.rate * (a.miles || 0));
    return sum + a.rate;
  }, 0);
}
