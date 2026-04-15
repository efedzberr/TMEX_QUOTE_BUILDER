import { ArrowRight, ArrowLeftRight, Route } from 'lucide-react';

interface LaneBadgeProps {
  serviceType: string;
  tripType: string;
  isSplitBilling?: boolean;
}

export function LaneBadge({ serviceType, tripType, isSplitBilling }: LaneBadgeProps) {
  const getBackgroundColor = () => {
    switch (serviceType) {
      case 'Loop':
        return '#3B82F6';
      case 'Door to Door':
        return '#22C55E';
      case 'Domestic':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };

  const getIcon = () => {
    switch (tripType) {
      case 'One Way':
        return <ArrowRight className="w-3 h-3" />;
      case 'Round Trip':
        return <ArrowLeftRight className="w-3 h-3" />;
      case 'Circuit':
        return <Route className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getTooltip = () => {
    return `${serviceType} — ${tripType}${isSplitBilling ? ' (Split Billing)' : ''}`;
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        style={{
          backgroundColor: getBackgroundColor(),
        }}
        className="inline-flex items-center justify-center w-6 h-6 rounded text-white"
        title={getTooltip()}
      >
        {getIcon()}
      </div>
      {isSplitBilling && (
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1 rounded">SPLIT</span>
      )}
    </div>
  );
}
