import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { EQUIPMENT_TYPES, formatCurrency } from '../../lib/constants';

export interface BenchmarkFilterValues {
  dateRange: string;
  equipmentType: string;
  tripType: string;
  marketRadius: string;
}

interface GlobalVars { fuel_rate_usd: number; mxn_exchange_rate: number; cad_exchange_rate: number; }

interface BenchmarkFiltersProps {
  filters: BenchmarkFilterValues;
  onChange: (filters: BenchmarkFilterValues) => void;
  defaultEquipment: string;
  defaultTripType: string;
}

const DATE_RANGES = ['Last 3 months', 'Last 6 months', 'Last 12 months', 'All time'];
const TRIP_OPTIONS = ['All', 'One Way', 'Round Trip', 'Circuit'];
const RADIUS_OPTIONS = ['Same City', 'Same Market', 'Same Region'];

export function BenchmarkFilters({ filters, onChange, defaultEquipment, defaultTripType }: BenchmarkFiltersProps) {
  const [globalVars, setGlobalVars] = useState<GlobalVars | null>(null);

  useEffect(() => { loadGlobalVars(); }, []);

  async function loadGlobalVars() {
    const { data } = await supabase.from('global_variables').select('fuel_rate_usd, mxn_exchange_rate, cad_exchange_rate').limit(1).maybeSingle();
    if (data) setGlobalVars(data);
  }

  function handleChange(field: keyof BenchmarkFilterValues, value: string) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-3">
      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Filters</h3>

      {[
        { label: 'Date Range', field: 'dateRange' as const, options: DATE_RANGES },
        { label: 'Equipment Type', field: 'equipmentType' as const, options: ['All', ...EQUIPMENT_TYPES], allLabel: 'All Equipment Types' },
        { label: 'Trip Type', field: 'tripType' as const, options: TRIP_OPTIONS },
        { label: 'Market Radius', field: 'marketRadius' as const, options: RADIUS_OPTIONS },
      ].map(item => (
        <div key={item.field}>
          <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">{item.label}</label>
          <select
            value={filters[item.field]}
            onChange={e => handleChange(item.field, e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {item.options.map(r => <option key={r} value={r}>{r === 'All' && item.allLabel ? item.allLabel : r}</option>)}
          </select>
        </div>
      ))}

      <div className="border-t border-gray-200 pt-2">
        <h4 className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Global Variables</h4>
        <div className="space-y-1.5">
          <div>
            <div className="text-[9px] text-gray-400 uppercase">Today's Fuel (RPM)</div>
            <div className="text-[11px] font-medium text-gray-800">{globalVars?.fuel_rate_usd ? formatCurrency(globalVars.fuel_rate_usd) : '—'}</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400 uppercase">MXN Rate</div>
            <div className="text-[11px] font-medium text-gray-800">{globalVars?.mxn_exchange_rate ? `$1.00 USD = $${globalVars.mxn_exchange_rate.toFixed(4)} MXN` : '—'}</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400 uppercase">CAD Rate</div>
            <div className="text-[11px] font-medium text-gray-800">{globalVars?.cad_exchange_rate ? `$1.00 USD = $${globalVars.cad_exchange_rate.toFixed(2)} CAD` : '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
