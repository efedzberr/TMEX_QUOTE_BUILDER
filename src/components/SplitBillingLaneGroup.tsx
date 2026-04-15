import { Lock } from 'lucide-react';
import { QuoteLane } from '../lib/supabase';
import { BORDER_CROSSINGS } from '../lib/constants';

interface SplitBillingLaneGroupProps {
  lanes: QuoteLane[];
  isBorderCity: (city: string) => boolean;
}

export function SplitBillingLaneGroup({ lanes, isBorderCity }: SplitBillingLaneGroupProps) {
  const getGroupLabel = (groupType?: string) => {
    if (groupType === 'one-way') return 'Split Billing - One Way';
    if (groupType === 'round-trip') return 'Split Billing - Round Trip';
    if (groupType === 'circuit') return 'Split Billing - Circuit';
    return 'Split Billing';
  };

  if (lanes.length === 0) return null;

  const groupType = lanes[0].split_billing_group;

  return (
    <div className="border-l-4 border-blue-500 pl-2">
      <div className="text-xs font-semibold text-blue-600 mb-1">{getGroupLabel(groupType)}</div>
      {lanes.map((lane, idx) => (
        <div key={lane.id} className="flex items-center gap-2 text-xs text-gray-600 mb-1">
          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Lane {idx + 1}</span>
          {lane.is_auto_populated && (
            <span className="flex items-center gap-1 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              <Lock className="w-3 h-3" />
              Auto
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
