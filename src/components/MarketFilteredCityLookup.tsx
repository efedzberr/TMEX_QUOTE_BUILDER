import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MarketCity {
  id: string;
  city_name: string;
  city_full_name: string;
  state_code: string;
  country_code: string;
  market_name: string;
}

interface MarketFilteredCityLookupProps {
  value: string;
  onChange: (value: string, marketName?: string, countryCode?: string) => void;
  marketFilter: string;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  countryFilter?: string;
}

export function MarketFilteredCityLookup({
  value,
  onChange,
  marketFilter,
  placeholder = 'Search cities...',
  hasError = false,
  disabled = false,
  disabledMessage,
  countryFilter,
}: MarketFilteredCityLookupProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<MarketCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!marketFilter || !open) return;
    setLoading(true);
    const fetchCities = async () => {
      let q = supabase
        .from('cities')
        .select('id, city_name, city_full_name, state_code, country_code, market_name')
        .eq('market_name', marketFilter)
        .order('city_name');

      if (countryFilter) {
        q = q.eq('country_code', countryFilter);
      }

      if (query.length >= 2) {
        q = q.or(`city_full_name.ilike.%${query}%,city_name.ilike.%${query}%`);
      }

      const { data } = await q.limit(100);
      if (data) setCities(data as MarketCity[]);
      setLoading(false);
    };
    fetchCities();
  }, [marketFilter, query, open, countryFilter]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom, left: rect.left, width: Math.max(rect.width, 280) });
  }, [open]);

  if (disabled) {
    return (
      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
        {disabledMessage || value || '—'}
      </div>
    );
  }

  const handleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left, width: Math.max(rect.width, 280) });
    }
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (city: MarketCity) => {
    onChange(city.city_full_name, city.market_name, city.country_code);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onChange('', undefined, undefined);
    setOpen(false);
  };

  const borderClass = hasError ? 'border-2 border-red-500' : 'border border-gray-300';

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm ${borderClass} rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-gray-400`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
      </button>

      {open && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 99999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-gray-100">
            <div className="text-[10px] text-blue-600 mb-1 px-1">
              Filtered by market: {marketFilter}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {value && (
              <button type="button" onClick={handleClear} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 italic">
                Clear selection
              </button>
            )}
            {loading ? (
              <div className="px-3 py-4 text-xs text-gray-500 text-center">Loading...</div>
            ) : cities.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-500 text-center italic">
                No cities found in this market
              </div>
            ) : (
              cities.map(city => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleSelect(city)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 hover:text-blue-700 transition-colors ${city.city_full_name === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}`}
                >
                  <div className="font-medium">{city.city_full_name}</div>
                  <div className="text-gray-400 text-[10px]">{city.country_code === 'USA' ? 'USA' : city.country_code === 'MEX' ? 'Mexico' : city.country_code}</div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
