import { QuoteLane } from '../../lib/supabase';
import { formatCurrency, CurrencyCode } from '../../lib/constants';
import { ChevronLeft, ChevronRight, Save, Pencil, X } from 'lucide-react';

interface LaneInformationCardProps {
  allLanes: QuoteLane[];
  activeLane: QuoteLane;
  activeLaneIndex: number;
  onLaneSelect: (lane: QuoteLane) => void;
  onSave: () => void;
  onSaveAndNext: () => void;
  onCancel: () => void;
  onEdit: () => void;
}

function ServiceBadge({ serviceType }: { serviceType?: string }) {
  if (!serviceType) return null;
  const colors: Record<string, string> = {
    'Loop': 'bg-blue-100 text-blue-700',
    'Door to Door': 'bg-emerald-100 text-emerald-700',
    'Domestic': 'bg-violet-100 text-violet-700',
  };
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${colors[serviceType] || 'bg-gray-100 text-gray-600'}`}>
      {serviceType}
    </span>
  );
}

export function LaneInformationCard({
  allLanes,
  activeLane,
  activeLaneIndex,
  onLaneSelect,
  onSave,
  onSaveAndNext,
  onCancel,
  onEdit,
}: LaneInformationCardProps) {
  const curr = (activeLane.currency_code || 'USD') as CurrencyCode;
  const canPrev = activeLaneIndex > 0;
  const canNext = activeLaneIndex < allLanes.length - 1;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <div className="flex items-start justify-between mb-1.5">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Lane Information</h3>
        <div className="flex items-center gap-1.5">
          <button onClick={onEdit} className="px-2 py-1 text-[11px] font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button onClick={() => canPrev && onLaneSelect(allLanes[activeLaneIndex - 1])} disabled={!canPrev} className="px-2 py-1 text-[11px] font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 flex items-center gap-0.5">
            <ChevronLeft className="w-3 h-3" /> Prev
          </button>
          <button onClick={() => canNext && onLaneSelect(allLanes[activeLaneIndex + 1])} disabled={!canNext} className="px-2 py-1 text-[11px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 flex items-center gap-0.5">
            Next <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <button onClick={onSave} className="px-2.5 py-1 text-[11px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700">Save</button>
        <button onClick={onSaveAndNext} className="px-2.5 py-1 text-[11px] font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700">Save & Next</button>
        <button onClick={onCancel} className="px-2 py-1 text-[11px] font-medium text-gray-500 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-0.5"><X className="w-3 h-3" /> Cancel</button>
      </div>

      <div className="space-y-0.5 max-h-[140px] overflow-y-auto">
        {allLanes.map((lane, i) => {
          const isActive = lane.id === activeLane.id;
          return (
            <button
              key={lane.id}
              onClick={() => onLaneSelect(lane)}
              className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
                isActive ? 'bg-blue-50 border-l-[3px] border-l-blue-600' : 'hover:bg-gray-50 border-l-[3px] border-l-transparent'
              }`}
            >
              <span className="text-[11px] font-bold text-gray-500 w-12 flex-shrink-0">Lane {i + 1}</span>
              <span className={`text-[11px] font-semibold truncate ${isActive ? 'text-blue-900' : 'text-gray-800'}`}>
                {lane.origin_city || '?'} → {lane.destination_city || '?'}
              </span>
              <ServiceBadge serviceType={lane.service_type} />
              {lane.trip_type && <span className="text-[10px] px-1 py-0.5 bg-gray-100 text-gray-600 rounded flex-shrink-0">{lane.trip_type}</span>}
              <div className="ml-auto flex items-center gap-3 flex-shrink-0 text-[10px] text-gray-500">
                <span>{lane.border_crossing || '—'}</span>
                <span>{lane.us_miles ? `${lane.us_miles.toFixed(0)} mi` : '—'}</span>
                <span>{lane.mx_miles ? `${lane.mx_miles.toFixed(0)} mi` : '—'}</span>
                <span>{lane.equipment_type || '—'}</span>
                <span className="font-semibold text-gray-700">{formatCurrency(lane.border_crossing_fee, curr)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
