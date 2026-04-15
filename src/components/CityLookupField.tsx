import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, ExternalLink } from 'lucide-react';
import { supabase, City } from '../lib/supabase';

export interface CityInfo {
  cityFullName: string;
  countryCode?: string;
  stateCode?: string;
  marketName?: string;
}

interface CityLookupFieldProps {
  value: string;
  onChange: (value: string, countryCode?: string, cityInfo?: CityInfo) => void;
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  countryFilter?: string;
  includeBorderCrossing?: boolean;
}

export function CityLookupField({
  value,
  onChange,
  placeholder = 'Search cities...',
  label,
  icon,
  countryFilter,
  includeBorderCrossing,
}: CityLookupFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalCities, setModalCities] = useState<City[]>([]);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchCities(searchTerm);
    } else {
      setCities([]);
    }
  }, [searchTerm, countryFilter, includeBorderCrossing]);

  useEffect(() => {
    if (modalSearchTerm.length >= 2) {
      searchModalCities(modalSearchTerm);
    } else {
      setModalCities([]);
    }
  }, [modalSearchTerm, countryFilter, includeBorderCrossing]);

  async function searchCities(term: string) {
    setLoading(true);

    const parts = term.split(',').map(p => p.trim());

    if (includeBorderCrossing && countryFilter) {
      const buildTextFilter = (q: any) => {
        if (parts.length === 2 && parts[1].length <= 2) {
          return q.ilike('city_name', `%${parts[0]}%`).ilike('state_code', `${parts[1]}%`);
        }
        return q.or(`city_full_name.ilike.%${term}%,city_name.ilike.%${term}%,city_code.ilike.%${term}%`);
      };

      let qCountry = supabase.from('cities').select('*');
      if (countryFilter === 'US_CAN') {
        qCountry = qCountry.in('country_code', ['USA', 'US', 'CAN', 'CA']);
      } else {
        qCountry = qCountry.eq('country_code', countryFilter);
      }
      qCountry = buildTextFilter(qCountry);

      let qBorder = supabase.from('cities').select('*').eq('is_border_crossing_city', true);
      qBorder = buildTextFilter(qBorder);

      const [r1, r2] = await Promise.all([qCountry.limit(30), qBorder.limit(30)]);
      const merged = new Map<string, City>();
      for (const c of [...(r1.data || []), ...(r2.data || [])]) {
        const key = `${c.city_full_name}|${c.market_name}`;
        if (!merged.has(key)) merged.set(key, c);
      }
      const all = Array.from(merged.values());

      const sorted = all.sort((a, b) => {
        const searchLower = term.toLowerCase();
        const aNameLower = a.city_name.toLowerCase();
        const bNameLower = b.city_name.toLowerCase();
        if (aNameLower === searchLower && bNameLower !== searchLower) return -1;
        if (bNameLower === searchLower && aNameLower !== searchLower) return 1;
        const aStarts = aNameLower.startsWith(searchLower);
        const bStarts = bNameLower.startsWith(searchLower);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        return aNameLower.localeCompare(bNameLower);
      });
      setCities(sorted.slice(0, 6));
      setLoading(false);
      return;
    }

    let query = supabase.from('cities').select('*');

    if (countryFilter === 'US_CAN') {
      query = query.in('country_code', ['USA', 'US', 'CAN', 'CA']);
    } else if (countryFilter) {
      query = query.eq('country_code', countryFilter);
    }

    if (parts.length === 2 && parts[1].length <= 2) {
      query = query
        .ilike('city_name', `%${parts[0]}%`)
        .ilike('state_code', `${parts[1]}%`);
    } else {
      query = query.or(`city_full_name.ilike.%${term}%,city_name.ilike.%${term}%,city_code.ilike.%${term}%`);
    }

    const { data, error } = await query.limit(50);

    if (!error && data) {
      const sorted = data.sort((a, b) => {
        const searchLower = term.toLowerCase();
        const aNameLower = a.city_name.toLowerCase();
        const bNameLower = b.city_name.toLowerCase();
        if (aNameLower === searchLower && bNameLower !== searchLower) return -1;
        if (bNameLower === searchLower && aNameLower !== searchLower) return 1;
        const aStarts = aNameLower.startsWith(searchLower);
        const bStarts = bNameLower.startsWith(searchLower);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        return aNameLower.localeCompare(bNameLower);
      });

      setCities(sorted.slice(0, 6));
    }
    setLoading(false);
  }

  async function searchModalCities(term: string) {
    setModalLoading(true);

    if (includeBorderCrossing && countryFilter) {
      let qCountry = supabase.from('cities').select('*');
      if (countryFilter === 'US_CAN') {
        qCountry = qCountry.in('country_code', ['USA', 'US', 'CAN', 'CA']);
      } else {
        qCountry = qCountry.eq('country_code', countryFilter);
      }
      qCountry = qCountry.or(`city_full_name.ilike.%${term}%,city_name.ilike.%${term}%,city_code.ilike.%${term}%,market_name.ilike.%${term}%,state_code.ilike.%${term}%,country_code.ilike.%${term}%`);

      let qBorder = supabase.from('cities').select('*').eq('is_border_crossing_city', true);
      qBorder = qBorder.or(`city_full_name.ilike.%${term}%,city_name.ilike.%${term}%,city_code.ilike.%${term}%,market_name.ilike.%${term}%,state_code.ilike.%${term}%,country_code.ilike.%${term}%`);

      const [r1, r2] = await Promise.all([qCountry.order('city_name').limit(60), qBorder.order('city_name').limit(60)]);
      const merged = new Map<string, City>();
      for (const c of [...(r1.data || []), ...(r2.data || [])]) {
        const key = `${c.city_full_name}|${c.market_name}`;
        if (!merged.has(key)) merged.set(key, c);
      }
      const all = Array.from(merged.values()).sort((a, b) => a.city_name.localeCompare(b.city_name));
      setModalCities(all.slice(0, 100));
      setModalLoading(false);
      return;
    }

    let query = supabase
      .from('cities')
      .select('*');

    if (countryFilter === 'US_CAN') {
      query = query.in('country_code', ['USA', 'US', 'CAN', 'CA']);
    } else if (countryFilter) {
      query = query.eq('country_code', countryFilter);
    }

    const { data, error } = await query
      .or(`city_full_name.ilike.%${term}%,city_name.ilike.%${term}%,city_code.ilike.%${term}%,market_name.ilike.%${term}%,state_code.ilike.%${term}%,country_code.ilike.%${term}%`)
      .order('city_name', { ascending: true })
      .limit(100);

    if (!error && data) {
      setModalCities(data);
    }
    setModalLoading(false);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideWrapper = wrapperRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideWrapper && !insideDropdown) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom,
      left: rect.left,
      width: Math.max(rect.width, 320),
    });
  }, [isOpen]);

  const handleSelect = (city: City) => {
    const cityInfo: CityInfo = {
      cityFullName: city.city_full_name,
      countryCode: city.country_code,
      stateCode: city.state_code,
      marketName: city.market_name,
    };
    onChange(city.city_full_name, city.country_code, cityInfo);
    setIsOpen(false);
    setSearchTerm('');
    setShowModal(false);
    setModalSearchTerm('');
  };

  const handleViewAll = () => {
    setModalSearchTerm(searchTerm);
    setShowModal(true);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {label && (
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:border-gray-400 transition-colors bg-white"
        >
          <div className="flex items-center gap-2 flex-1 text-left">
            {icon}
            <span className={value ? 'text-gray-900' : 'text-gray-400'}>
              {value || placeholder}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {isOpen && dropdownPos && createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 99999,
            }}
            className="bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden"
          >
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[320px]">
              {loading ? (
                <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
              ) : searchTerm.length < 2 ? (
                <div className="px-3 py-2 text-sm text-gray-500">Type at least 2 characters to search</div>
              ) : cities.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
              ) : (
                cities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => handleSelect(city)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                      city.city_full_name === value ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-base font-bold ${
                            city.city_full_name === value ? 'text-blue-600' : 'text-gray-900'
                          }`}>
                            {city.city_full_name}
                          </span>
                          {city.city_code && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              {city.city_code}
                            </span>
                          )}
                          {city.country_code && (
                            <span className="text-sm text-gray-600">
                              · {city.country_code === 'USA' ? 'USA' : city.country_code === 'MEX' ? 'México' : city.country_code}
                            </span>
                          )}
                        </div>
                        {city.market_name && (
                          <div className="text-xs text-blue-600">
                            Market: {city.market_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            {searchTerm.length >= 2 && (
              <div className="border-t border-gray-200 p-2">
                <button
                  type="button"
                  onClick={handleViewAll}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  View All Results
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-[760px] h-[580px] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">City Search</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  placeholder="Search by city, state, code, market, or country..."
                  className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              {modalSearchTerm.length >= 2 && (
                <div className="mt-2 text-sm text-gray-600">
                  {modalCities.length} {modalCities.length === 1 ? 'city' : 'cities'} found
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {modalLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : modalSearchTerm.length < 2 ? (
                <div className="text-center py-8 text-gray-500">Type at least 2 characters to search</div>
              ) : modalCities.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-900 font-medium mb-2">No cities found</div>
                  <div className="text-gray-500 text-sm">Try a different search term</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {modalCities.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => handleSelect(city)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors rounded-md border border-transparent hover:border-gray-200 ${
                        city.city_full_name === value ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="grid grid-cols-4 gap-4 items-center">
                        <div className="col-span-2">
                          <div className="font-bold text-gray-900">{city.city_full_name}</div>
                        </div>
                        <div>
                          {city.city_code && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              {city.city_code}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          {city.country_code && (
                            <span className="text-sm text-gray-600">
                              {city.country_code === 'USA' ? 'USA' : city.country_code === 'MEX' ? 'México' : city.country_code}
                            </span>
                          )}
                        </div>
                      </div>
                      {city.market_name && (
                        <div className="text-xs text-blue-600 mt-1">
                          Market: {city.market_name}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
