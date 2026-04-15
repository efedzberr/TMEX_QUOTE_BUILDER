import { QuoteLane } from '../../lib/supabase';
import { formatCurrency, CurrencyCode } from '../../lib/constants';

interface BenchmarkLaneHeaderProps {
  lane: QuoteLane;
  laneIndex: number;
}

function ServiceBadge({ serviceType }: { serviceType?: string }) {
  if (!serviceType) return null;
  const colors: Record<string, string> = {
    'Loop': 'bg-blue-100 text-blue-700 border-blue-200',
    'Door to Door': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Domestic': 'bg-violet-100 text-violet-700 border-violet-200',
  };
  const cls = colors[serviceType] || 'bg-gray-100 text-gray-700 border-gray-200';
  return <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${cls}`}>{serviceType}</span>;
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-4">
      <div className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

export function BenchmarkLaneHeader({ lane, laneIndex }: BenchmarkLaneHeaderProps) {
  const curr = (lane.currency_code || 'USD') as CurrencyCode;

  return (
    <div className="bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg px-6 py-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-lg font-bold text-gray-900">Lane {laneIndex}</span>
          <span className="text-base font-semibold text-gray-800">
            {lane.origin_city || '—'} → {lane.destination_city || '—'}
          </span>
          <ServiceBadge serviceType={lane.service_type} />
          {lane.trip_type && (
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full border bg-gray-100 text-gray-700 border-gray-200">
              {lane.trip_type}
            </span>
          )}
          {lane.split_billing_group && (
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full border bg-amber-100 text-amber-700 border-amber-200">
              Split Billing
            </span>
          )}
        </div>

        <div className="flex items-center divide-x divide-blue-200">
          <InfoPair label="Border Crossing" value={lane.border_crossing || '—'} />
          <InfoPair label="US Miles" value={lane.us_miles ? lane.us_miles.toFixed(0) : '—'} />
          <InfoPair label="MX Miles" value={lane.mx_miles ? lane.mx_miles.toFixed(0) : '—'} />
          <InfoPair label="Equipment" value={lane.equipment_type || '—'} />
          <InfoPair label="Border Fee" value={formatCurrency(lane.border_crossing_fee, curr)} />
        </div>
      </div>
    </div>
  );
}
