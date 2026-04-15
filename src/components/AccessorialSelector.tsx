import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrencyOrDash, CurrencyCode } from '../lib/constants';

export interface Accessorial {
  id: string;
  commodity: string;
  name_en: string;
  name_es: string;
  default_rate: number;
  unit_type: string;
  notes: string;
}

export interface SelectedAccessorial extends Accessorial {
  quantity: number;
  rate: number;
}

interface AccessorialSelectorProps {
  selectedAccessorials: SelectedAccessorial[];
  onAccessorialsChange: (accessories: SelectedAccessorial[]) => void;
  currencyCode?: CurrencyCode;
}

export function AccessorialSelector({ selectedAccessorials, onAccessorialsChange, currencyCode = 'USD' }: AccessorialSelectorProps) {
  const [allAccessorials, setAllAccessorials] = useState<Accessorial[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccessorials();
  }, []);

  useEffect(() => {
    setCheckedItems(new Set(selectedAccessorials.map(a => a.id)));
  }, [selectedAccessorials]);

  async function loadAccessorials() {
    const { data, error } = await supabase
      .from('accessorials')
      .select('*')
      .order('commodity', { ascending: true })
      .order('name_en', { ascending: true });

    if (error) {
      console.error('Error loading accessorials:', error);
    } else if (data) {
      setAllAccessorials(data);
    }
    setLoading(false);
  }

  const filteredAccessorials = allAccessorials.filter(a =>
    a.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.name_es.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (accessorial: Accessorial) => {
    const newChecked = new Set(checkedItems);

    if (newChecked.has(accessorial.id)) {
      newChecked.delete(accessorial.id);
      onAccessorialsChange(selectedAccessorials.filter(a => a.id !== accessorial.id));
    } else {
      newChecked.add(accessorial.id);
      const newAccessorial: SelectedAccessorial = {
        ...accessorial,
        quantity: accessorial.unit_type === 'RPM' ? 1 : 1,
        rate: accessorial.default_rate,
      };
      onAccessorialsChange([...selectedAccessorials, newAccessorial]);
    }

    setCheckedItems(newChecked);
  };

  const handleRateChange = (id: string, newRate: number) => {
    const updated = selectedAccessorials.map(a =>
      a.id === id ? { ...a, rate: newRate } : a
    );
    onAccessorialsChange(updated);
  };

  const handleQuantityChange = (id: string, newQuantity: number) => {
    const updated = selectedAccessorials.map(a =>
      a.id === id ? { ...a, quantity: newQuantity } : a
    );
    onAccessorialsChange(updated);
  };

  const handleRemove = (id: string) => {
    const newChecked = new Set(checkedItems);
    newChecked.delete(id);
    setCheckedItems(newChecked);
    onAccessorialsChange(selectedAccessorials.filter(a => a.id !== id));
  };

  const totalAccessorials = selectedAccessorials.reduce((sum, a) => {
    if (a.unit_type === 'RPM') {
      return sum + (a.rate * a.quantity);
    }
    return sum + a.rate;
  }, 0);

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Loading accessorials...</div>;
  }

  return (
    <div className="space-y-4">
      {selectedAccessorials.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Selected Accessorials</h4>
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700 mb-2">
              <div className="col-span-5">Accessorial</div>
              <div className="col-span-2">Unit</div>
              <div className="col-span-3">Rate</div>
              <div className="col-span-2">Action</div>
            </div>
            {selectedAccessorials.map(acc => (
              <div key={acc.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-white border border-gray-200 rounded">
                <div className="col-span-5 text-xs text-gray-900">
                  <div className="font-medium">{acc.name_en}</div>
                  <div className="text-gray-500 text-xs">{acc.name_es}</div>
                </div>
                <div className="col-span-2 text-xs text-gray-700">
                  {acc.unit_type === 'RPM' ? (
                    <input
                      type="number"
                      value={acc.quantity}
                      onChange={(e) => handleQuantityChange(acc.id, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="0"
                      min="0"
                      step="0.1"
                    />
                  ) : (
                    <span>{acc.unit_type}</span>
                  )}
                </div>
                <div className="col-span-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span>{currencyCode} $</span>
                    <input
                      type="number"
                      value={acc.rate}
                      onChange={(e) => handleRateChange(acc.id, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <button
                    onClick={() => handleRemove(acc.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex justify-between items-center text-sm font-semibold text-gray-900">
              <span>Total Accessorials:</span>
              <span className="text-lg text-blue-600">{formatCurrencyOrDash(totalAccessorials, currencyCode)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="border border-gray-300 rounded-lg p-4 bg-white">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search accessorials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded mb-4">
          {filteredAccessorials.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No accessorials found</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAccessorials.map(acc => (
                <div key={acc.id} className="p-3 hover:bg-blue-50 cursor-pointer">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkedItems.has(acc.id)}
                      onChange={() => handleToggle(acc)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{acc.name_en}</div>
                      <div className="text-xs text-gray-600">{acc.name_es}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="bg-gray-100 px-2 py-0.5 rounded mr-2">
                          {acc.unit_type}
                        </span>
                        <span className="text-blue-600 font-semibold">
                          {formatCurrencyOrDash(acc.default_rate, currencyCode)}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
