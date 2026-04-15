import { Search, X } from 'lucide-react';

export interface AccountLaneFilterValues {
  search: string;
  contract: string;
  parentAccount: string;
  shipper: string;
  originCity: string;
  destinationCity: string;
  tariffType: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: AccountLaneFilterValues = {
  search: '',
  contract: '',
  parentAccount: '',
  shipper: '',
  originCity: '',
  destinationCity: '',
  tariffType: '',
  dateFrom: '',
  dateTo: '',
};

interface AccountLaneFiltersProps {
  filters: AccountLaneFilterValues;
  onChange: (filters: AccountLaneFilterValues) => void;
  parentAccounts: string[];
  shippers: string[];
  tariffTypes: string[];
  filteredCount: number;
  totalCount: number;
}

export function AccountLaneFilters({
  filters,
  onChange,
  parentAccounts,
  shippers,
  tariffTypes,
  filteredCount,
  totalCount,
}: AccountLaneFiltersProps) {
  const hasActive = Object.entries(filters).some(
    ([, v]) => v !== ''
  );

  function set(key: keyof AccountLaneFilterValues, value: string) {
    onChange({ ...filters, [key]: value });
  }

  const inputClass =
    'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const selectClass =
    'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white';

  return (
    <div className="space-y-3 mb-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by contract, shipper, account, city..."
              value={filters.search}
              onChange={e => set('search', e.target.value)}
              className={`${inputClass} pl-9 w-full`}
            />
          </div>
        </div>

        <div className="w-[160px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Contract</label>
          <input
            type="text"
            placeholder="Contract #"
            value={filters.contract}
            onChange={e => set('contract', e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>

        <div className="w-[180px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Parent Account</label>
          <select
            value={filters.parentAccount}
            onChange={e => set('parentAccount', e.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="">All Accounts</option>
            {parentAccounts.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="w-[180px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Shipper</label>
          <select
            value={filters.shipper}
            onChange={e => set('shipper', e.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="">All Shippers</option>
            {shippers.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="w-[160px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Origin City</label>
          <input
            type="text"
            placeholder="Origin city..."
            value={filters.originCity}
            onChange={e => set('originCity', e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>

        <div className="w-[160px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Dest. City</label>
          <input
            type="text"
            placeholder="Destination city..."
            value={filters.destinationCity}
            onChange={e => set('destinationCity', e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>

        <div className="w-[140px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Tariff Type</label>
          <select
            value={filters.tariffType}
            onChange={e => set('tariffType', e.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="">All Types</option>
            {tariffTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="w-[140px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">From Date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => set('dateFrom', e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>

        <div className="w-[140px]">
          <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">To Date</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => set('dateTo', e.target.value)}
            className={`${inputClass} w-full`}
          />
        </div>

        {hasActive && (
          <button
            onClick={() => onChange({ ...EMPTY_FILTERS })}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}

        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-full whitespace-nowrap">
          {filteredCount} of {totalCount} records
        </span>
      </div>
    </div>
  );
}
