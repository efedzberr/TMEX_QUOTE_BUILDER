import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Plus } from 'lucide-react';

interface LookupFieldProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  onCreateNew?: (value: string) => Promise<void>;
}

export function LookupField({
  value,
  options,
  onChange,
  placeholder = 'Search...',
  label,
  icon,
  onCreateNew,
}: LookupFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exactMatch = options.some(
    (o) => o.toLowerCase() === searchTerm.toLowerCase()
  );

  const canCreate = onCreateNew && searchTerm.trim().length > 0 && !exactMatch;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCreate = async () => {
    if (!onCreateNew || !searchTerm.trim()) return;
    setCreating(true);
    await onCreateNew(searchTerm.trim());
    onChange(searchTerm.trim());
    setCreating(false);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <button
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

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-48">
              {filteredOptions.length === 0 && !canCreate ? (
                <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                      option === value ? 'bg-blue-50 text-blue-600' : 'text-gray-900'
                    }`}
                  >
                    {option}
                  </button>
                ))
              )}
              {canCreate && (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2 border-t border-gray-100 font-medium disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {creating ? 'Adding...' : `Add "${searchTerm.trim()}"`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
