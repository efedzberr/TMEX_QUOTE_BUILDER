import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BorderCity {
  id: string;
  city_name: string;
  city_full_name: string | null;
  state_code: string | null;
  country_code: string | null;
}

interface BorderCrossingLookupProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  hasError?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function useBorderCrossingCities() {
  const [cities, setCities] = useState<BorderCity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('cities')
        .select('id, city_name, city_full_name, state_code, country_code')
        .eq('is_border_crossing_city', true)
        .order('city_name');
      if (!cancelled && data) setCities(data);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { cities, loading };
}

export function BorderCrossingLookup({
  value,
  onChange,
  className = '',
  hasError = false,
  placeholder = 'Select border crossing city...',
  disabled = false,
  size = 'md',
}: BorderCrossingLookupProps) {
  const { cities, loading } = useBorderCrossingCities();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = cities.filter(c =>
    (c.city_full_name || c.city_name).toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideContainer = containerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideContainer && !insideDropdown) {
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
    setDropdownPos({
      top: rect.bottom,
      left: rect.left,
      width: Math.max(rect.width, 200),
    });
  }, [open]);

  function handleOpen() {
    if (disabled) return;
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom,
        left: rect.left,
        width: Math.max(rect.width, 200),
      });
    }
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSelect(city: BorderCity) {
    onChange(city.city_full_name || city.city_name);
    setOpen(false);
    setQuery('');
  }

  function handleClear() {
    onChange('');
    setOpen(false);
  }

  const isSmall = size === 'sm';
  const borderClass = hasError ? 'border-2 border-red-500' : 'border border-gray-300';
  const sizeClass = isSmall ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm';

  const displayLabel = value || '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`w-full flex items-center justify-between ${sizeClass} ${borderClass} rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-gray-400'}`}
      >
        <span className={displayLabel ? 'text-gray-900' : 'text-gray-400'}>
          {loading ? 'Loading...' : (displayLabel || placeholder)}
        </span>
        <ChevronDown className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'} text-gray-400 flex-shrink-0 ml-1`} />
      </button>

      {open && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 99999,
          }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-gray-100">
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
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 italic"
              >
                Clear selection
              </button>
            )}
            {loading ? (
              <div className="px-3 py-4 text-xs text-gray-500 text-center">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-500 text-center italic">
                {cities.length === 0
                  ? 'No border crossing cities available'
                  : 'No matching cities'}
              </div>
            ) : (
              filtered.map(city => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleSelect(city)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 hover:text-blue-700 transition-colors ${(city.city_full_name || city.city_name) === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}`}
                >
                  <div className="font-medium">{city.city_full_name || city.city_name}</div>
                  {city.country_code && (
                    <div className="text-gray-400 text-[10px]">{city.country_code}</div>
                  )}
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

export function validateBorderCrossing(value: string, cities: BorderCity[]): string | null {
  if (!value) return null;
  const match = cities.find(c => (c.city_full_name || c.city_name) === value);
  if (!match) {
    return 'This city is not marked as a Border Crossing City. Please select a valid border crossing city.';
  }
  return null;
}
