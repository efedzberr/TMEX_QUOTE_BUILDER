import { useState, useEffect, useRef } from 'react';
import { supabase, City } from '../lib/supabase';

interface CityAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CityAutocompleteInput({
  value,
  onChange,
  placeholder = 'City',
  className = '',
}: CityAutocompleteInputProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchCities(searchTerm);
    } else {
      setSuggestions([]);
    }
  }, [searchTerm]);

  async function searchCities(term: string) {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .or(`city_full_name.ilike.%${term}%,city_name.ilike.%${term}%,city_code.ilike.%${term}%`)
      .order('city_name', { ascending: true })
      .limit(20);

    if (!error && data) {
      setSuggestions(data);
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setShowSuggestions(true);
    onChange(newValue);
  };

  const handleSelect = (city: City) => {
    setSearchTerm(city.city_full_name);
    onChange(city.city_full_name);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => handleSelect(city)}
              className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <span>{city.city_full_name}</span>
                {city.city_code && (
                  <span className="text-xs text-gray-400">{city.city_code}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
